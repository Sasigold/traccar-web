-- viper fleet: files nothing points to any more (SEC-17). Idempotent.
--
-- A file stays in Storage when its row is deleted, or when an upload succeeded and the save that
-- followed did not. fleet_orphan_files() lists, for the caller's organization, the files of the
-- fleet-files bucket that no row references and that are older than a grace period (30 days by
-- default: a driver's phone can upload a photo days before the row arrives).
--
-- "Referenced" is found from the schema itself, so new tables are covered without a change here:
-- every text column of a public table named *_path, and every text[] column named *_paths or
-- photos. The files themselves are removed through the Storage API (by the app, under the
-- existing fleet_files_delete policy), never by deleting rows of storage.objects, which would
-- leave the bytes on disk.
-- Who: the organization's owner or admin.

begin;

create or replace function public.fleet_referenced_paths()
returns setof text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  col record;
begin
  for col in
    select c.table_name, c.column_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and ((c.data_type = 'text' and c.column_name like '%\_path')
            or (c.data_type = 'ARRAY' and c.udt_name = '_text'
                and (c.column_name like '%\_paths' or c.column_name = 'photos')))
  loop
    if col.data_type = 'text' then
      return query execute format('select %I from public.%I where %I is not null',
                                  col.column_name, col.table_name, col.column_name);
    else
      return query execute format('select unnest(%I) from public.%I where %I is not null',
                                  col.column_name, col.table_name, col.column_name);
    end if;
  end loop;
end;
$$;

revoke all on function public.fleet_referenced_paths() from public, anon, authenticated;

create or replace function public.fleet_orphan_files(p_min_age interval default interval '30 days')
returns table (name text, size bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_org_id();
begin
  if v_org is null or coalesce(public.current_role_name(), '') not in ('owner', 'admin') then
    raise exception 'owner or admin only' using errcode = '42501';
  end if;
  if p_min_age < interval '7 days' then
    raise exception 'the grace period is at least 7 days' using errcode = '22023';
  end if;
  return query
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
      from storage.objects o
     where o.bucket_id = 'fleet-files'
       and o.name like v_org::text || '/%'
       and o.created_at < now() - p_min_age
       and not exists (select 1 from public.fleet_referenced_paths() r(path) where r.path = o.name)
     order by o.created_at;
end;
$$;

revoke all on function public.fleet_orphan_files(interval) from public, anon;
grant execute on function public.fleet_orphan_files(interval) to authenticated;

commit;
