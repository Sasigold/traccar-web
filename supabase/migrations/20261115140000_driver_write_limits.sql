-- viper fleet: what a driver may write (SEC-14). Idempotent.
--
-- A driver adds incidents and inspections but does not rewrite or delete them; who reported or
-- created a row is set here from auth.uid(), not by the browser. On a dispatch job a driver may
-- change only the status (along the legal steps: assigned -> en_route -> arrived -> done or
-- failed), the notes and the proof of delivery; a cancelled or finished job stays as it is.

begin;

-- 1. Incidents and inspections: insert only, for drivers.
do $$
declare
  spec text[];
  specs text[][] := array[
    ['inspections', 'inspections.write', '(created_by = auth.uid() or driver_id = public.my_driver_id())'],
    ['incidents', 'incidents.write', '(reported_by = auth.uid() or driver_id = public.my_driver_id())']
  ];
begin
  foreach spec slice 1 in array specs loop
    execute format('drop policy if exists %I on public.%I', spec[1] || '_write', spec[1]);
    -- Managers: everything, as before.
    execute format(
      'create policy %I on public.%I for all using (org_id = public.current_org_id() and public.has_permission(%L) and not public.is_driver_role()) with check (org_id = public.current_org_id() and public.has_permission(%L) and not public.is_driver_role())',
      spec[1] || '_write', spec[1], spec[2], spec[2]);
    execute format('drop policy if exists %I on public.%I', spec[1] || '_driver_insert', spec[1]);
    execute format(
      'create policy %I on public.%I for insert with check (org_id = public.current_org_id() and public.has_permission(%L) and public.is_driver_role() and %s)',
      spec[1] || '_driver_insert', spec[1], spec[2], spec[3]);
  end loop;
end $$;

-- The author of a row is whoever is signed in.
create or replace function public.set_row_author()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is not null then
    if tg_table_name = 'incidents' then
      new.reported_by := auth.uid();
    else
      new.created_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists incidents_author on public.incidents;
create trigger incidents_author before insert on public.incidents
  for each row execute function public.set_row_author();
drop trigger if exists inspections_author on public.inspections;
create trigger inspections_author before insert on public.inspections
  for each row execute function public.set_row_author();

-- 2. Dispatch jobs: a driver changes only these columns, along legal steps. The trigger's name
--    makes it run before the other triggers of the table, on what the driver sent.
create or replace function public.dispatch_driver_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  allowed text[] := array['status', 'notes', 'proof_name', 'proof_photo_path',
                          'proof_signature_path', 'started_at', 'arrived_at', 'completed_at'];
  changed text;
begin
  -- Only the driver's own writes: the database's functions (security definer, e.g. closing the
  -- tracking link when private mode starts) run as their owner and are not limited here.
  if current_user <> 'authenticated' or not public.is_driver_role() then
    return new;
  end if;
  for changed in
    select key from jsonb_each(to_jsonb(new))
     where to_jsonb(new) -> key is distinct from to_jsonb(old) -> key
  loop
    if not changed = any(allowed) then
      raise exception 'a driver cannot change %', changed using errcode = '42501';
    end if;
  end loop;
  if new.status is distinct from old.status and not (
       (old.status in ('planned', 'assigned') and new.status = 'en_route')
    or (old.status = 'en_route' and new.status in ('arrived', 'done', 'failed'))
    or (old.status = 'arrived' and new.status in ('done', 'failed'))
  ) then
    raise exception 'a job cannot go from % to %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists dispatch_jobs_a_driver_guard on public.dispatch_jobs;
create trigger dispatch_jobs_a_driver_guard before update on public.dispatch_jobs
  for each row execute function public.dispatch_driver_guard();

commit;
