-- Driver check-in (SAF-02): a driver of the organization with the vehicle's code starts an
-- assignment and ends the open ones; a wrong code, another organization's vehicle or a user who
-- is not a driver are refused.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

insert into public.organizations (id, name) values
  ('a6000000-0000-0000-0000-000000000000', 'Check-in A'),
  ('b6000000-0000-0000-0000-000000000000', 'Check-in B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000006a1', 'a6000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000006a2', 'a6000000-0000-0000-0000-000000000000', 'viewer');
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000006a1', 'דנה'),
  ('d6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000000', null, 'יוסי');
insert into public.vehicles (id, org_id, traccar_device_id, plate_number, checkin_code) values
  ('c6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000', 61, '12-345-67', 'code-a1'),
  ('c6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000000', 62, '23-456-78', 'code-a2'),
  ('c6000000-0000-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000000', 63, '34-567-89', 'code-b1');
-- Yossi has vehicle 61; Dana had vehicle 62.
insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at) values
  ('a6000000-0000-0000-0000-000000000000', 'c6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000002', now() - interval '1 day'),
  ('a6000000-0000-0000-0000-000000000000', 'c6000000-0000-0000-0000-000000000002', 'd6000000-0000-0000-0000-000000000001', now() - interval '1 day');

select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
do $$ begin
  begin
    perform public.driver_check_in(61, 'wrong');
    assert false, 'a wrong code is refused';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.driver_check_in(63, 'code-b1');
    assert false, 'another organization''s vehicle is refused';
  exception when insufficient_privilege then null;
  end;
  assert (public.driver_check_in(61, 'code-a1') ->> 'plate_number') = '12-345-67', 'checked in';
end $$;

select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.vehicle_driver_assignments where ends_at is null) = 1,
    'only the new assignment is open';
  assert (select driver_id from public.vehicle_driver_assignments where ends_at is null)
    = 'd6000000-0000-0000-0000-000000000001', 'Dana drives 61 now';
end $$;

-- A viewer who is not a driver cannot check in, nor make a new code.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a2');
do $$ begin
  begin
    perform public.driver_check_in(62, 'code-a2');
    assert false, 'not a driver';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.vehicle_new_checkin_code('c6000000-0000-0000-0000-000000000002');
    assert false, 'only managers make new codes';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
\echo 'driver_checkin.test.sql: all assertions passed'
