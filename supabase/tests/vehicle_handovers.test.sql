-- ISR-11: a driver signs their own handover, never someone else's, and cannot change it later;
-- the manager reads every handover; another organization sees none.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select case public.current_role_name()
    when 'driver' then p_permission = 'inspections.write'
    when 'manager' then p_permission in ('inspections.read', 'inspections.write')
    else false end
$$;

insert into public.organizations (id, name) values
  ('ab100000-0000-0000-0000-000000000000', 'Hand A'),
  ('ab200000-0000-0000-0000-000000000000', 'Hand B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000ab101', 'ab100000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000ab102', 'ab100000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-0000000ab201', 'ab200000-0000-0000-0000-000000000000', 'manager');
insert into public.vehicles (id, org_id, traccar_device_id) values
  ('ab100000-0000-0000-0000-0000000000a1', 'ab100000-0000-0000-0000-000000000000', 101);
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('ab100000-0000-0000-0000-0000000000d1', 'ab100000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000ab101', 'דנה'),
  ('ab100000-0000-0000-0000-0000000000d2', 'ab100000-0000-0000-0000-000000000000', null, 'יוסי');

select pg_temp.as_user('00000000-0000-0000-0000-0000000ab101');
do $$ begin
  insert into public.vehicle_handovers (org_id, vehicle_id, driver_id, kind, odometer_km, fuel_percent)
  values ('ab100000-0000-0000-0000-000000000000', 'ab100000-0000-0000-0000-0000000000a1',
          'ab100000-0000-0000-0000-0000000000d1', 'handover', 45210, 75);
  begin
    insert into public.vehicle_handovers (org_id, vehicle_id, driver_id, kind)
    values ('ab100000-0000-0000-0000-000000000000', 'ab100000-0000-0000-0000-0000000000a1',
            'ab100000-0000-0000-0000-0000000000d2', 'handover');
    assert false, 'a driver does not sign for another driver';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.vehicle_handovers set odometer_km = 1;
    assert false, 'a handover is not changed';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.vehicle_handovers) = 1, 'the driver reads their own';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000ab102');
do $$ begin
  assert (select count(*) from public.vehicle_handovers) = 1, 'the manager reads it';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000ab201');
do $$ begin
  assert (select count(*) from public.vehicle_handovers) = 0, 'another organization sees none';
end $$;

rollback;
