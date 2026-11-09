-- viper fleet: employees' privacy rights (SEC-12, on top of ISR-03's privacy migration). Idempotent.
--
--   - Turning "private" on stops the customer tracking links of that driver's and vehicle's open
--     jobs at once (a link would otherwise keep showing where the car is).
--   - privacy_subject_export(driver): everything the fleet database keeps about one employee, for
--     a request to see one's data. Recorded in the view log.
--   - privacy_erase_driver(driver): when an employee leaves and the organization must not keep
--     their personal details: the name, ID number, phone, e-mail, licence and notes are erased,
--     their documents are deleted (the files' paths are returned for the app to delete from
--     storage), the full copies in the audit log are reduced to "erased", and a linked user
--     profile loses its name (switching the user off stays in user management). Records the organization must keep (incidents,
--     tickets, inspections) stay, attached to the anonymous driver.
--
-- Both need privacy.manage and work in the caller's organization only.

begin;

alter table public.drivers add column if not exists erased_at timestamptz;
alter table public.profiles add column if not exists erased_at timestamptz;

-- ─── private periods stop tracking links ────────────────────────────────────

create or replace function public.privacy_private_close_links()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.dispatch_jobs
     set tracking_link = null,
         tracking_expires_at = least(coalesce(tracking_expires_at, now()), now())
   where org_id = new.org_id
     and tracking_link is not null
     and status not in ('done', 'failed', 'cancelled')
     and ((new.driver_id is not null and driver_id = new.driver_id)
          or (new.vehicle_id is not null and vehicle_id = new.vehicle_id));
  return null;
end;
$$;

drop trigger if exists privacy_private_close_links on public.privacy_private_periods;
create trigger privacy_private_close_links after insert on public.privacy_private_periods
  for each row execute function public.privacy_private_close_links();

-- ─── the employee's data ────────────────────────────────────────────────────

create or replace function public.privacy_driver_of_org(p_driver uuid)
returns public.drivers
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v public.drivers;
begin
  if not public.has_permission('privacy.manage') then
    raise exception 'privacy.manage is required' using errcode = '42501';
  end if;
  select * into v from public.drivers where id = p_driver and org_id = public.current_org_id();
  if v.id is null then
    raise exception 'no such driver in this organization' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- Tables that point at a driver (a driver_id column), found in the schema, so a new table is
-- covered without changing this function.
create or replace function public.privacy_driver_tables()
returns setof text
language sql
stable
as $$
  select c.table_name::text
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and c.column_name = 'driver_id' and t.table_type = 'BASE TABLE'
   order by 1
$$;

create or replace function public.privacy_subject_export(p_driver uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver public.drivers := public.privacy_driver_of_org(p_driver);
  v_result jsonb;
  v_rows jsonb;
  v_table text;
begin
  v_result := jsonb_build_object(
    'exported_at', now(),
    'driver', to_jsonb(v_driver),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_driver.profile_id),
    'records', '{}'::jsonb);
  for v_table in select public.privacy_driver_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]'') from public.%I t where t.driver_id = $1',
                   v_table)
      into v_rows using p_driver;
    if jsonb_array_length(v_rows) > 0 then
      v_result := jsonb_set(v_result, array['records', v_table], v_rows);
    end if;
  end loop;
  insert into public.privacy_view_log (org_id, profile_id, traccar_device_ids, view)
  values (v_driver.org_id, auth.uid(), '{}', 'export');
  return v_result;
end;
$$;

-- Returns { files: [{ bucket, path }], tables: { name: rows } }.
create or replace function public.privacy_erase_driver(p_driver uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver public.drivers := public.privacy_driver_of_org(p_driver);
  v_files jsonb := '[]';
  v_paths jsonb;
  v_table text;
  v_column text;
  v_count integer;
  v_counts jsonb := '{}';
begin
  -- Files of the driver's own documents (bucket "documents") and of other driver records
  -- (bucket "fleet-files"), for the app to delete from storage.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', 'documents', 'path', storage_path)), '[]')
    into v_files from public.documents where driver_id = p_driver and storage_path is not null;
  for v_table, v_column in
    select c.table_name, c.column_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name like '%path'
       and c.table_name in (select public.privacy_driver_tables()) and c.table_name <> 'documents'
  loop
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''bucket'', ''fleet-files'', ''path'', t.%I)), ''[]'')
                      from public.%I t where t.driver_id = $1 and t.%I is not null', v_column, v_table, v_column)
      into v_paths using p_driver;
    v_files := v_files || v_paths;
  end loop;

  delete from public.documents where driver_id = p_driver;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('documents', v_count);

  update public.drivers
     set full_name = 'נהג שנמחק', national_id = null, phone = null, email = null,
         license_number = null, notes = null, traccar_driver_id = null, erased_at = now()
   where id = p_driver;

  -- The audit log kept full copies of the row; keep that something changed, not what.
  update public.audit_log
     set old_data = case when old_data is null then null else '{"erased": true}'::jsonb end,
         new_data = case when new_data is null then null else '{"erased": true}'::jsonb end
   where (table_name = 'drivers' and row_id = p_driver::text)
      or old_data->>'driver_id' = p_driver::text
      or new_data->>'driver_id' = p_driver::text;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('audit_log', v_count);

  if v_driver.profile_id is not null then
    -- The name only: switching the user off stays a user-management action (SEC-08).
    update public.profiles set full_name = null, erased_at = now() where id = v_driver.profile_id;
  end if;

  insert into public.audit_log (org_id, user_id, action, table_name, row_id, new_data)
  values (v_driver.org_id, auth.uid(), 'update', 'drivers', p_driver::text,
          jsonb_build_object('erased', true, 'files', jsonb_array_length(v_files)));
  return jsonb_build_object('files', v_files, 'tables', v_counts);
end;
$$;

revoke all on function public.privacy_driver_of_org(uuid) from public, anon;
revoke all on function public.privacy_subject_export(uuid) from public, anon;
revoke all on function public.privacy_erase_driver(uuid) from public, anon;
grant execute on function public.privacy_subject_export(uuid) to authenticated;
grant execute on function public.privacy_erase_driver(uuid) to authenticated;

commit;
