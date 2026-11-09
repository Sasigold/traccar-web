-- Employee location privacy (ISR-03): who reads and changes what, the private switch, the view log.
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
  ('a1000000-0000-0000-0000-000000000000', 'Privacy A'),
  ('b1000000-0000-0000-0000-000000000000', 'Privacy B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000001a1', 'a1000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000001a2', 'a1000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000001a3', 'a1000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-0000000001b1', 'b1000000-0000-0000-0000-000000000000', 'owner');
insert into public.vehicles (id, org_id, traccar_device_id) values
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 501);
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000001a2', 'Driver');
insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at) values
  ('a1000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001', now() - interval '1 day');

-- The owner sets the policy and publishes a notice; the viewer reads both but changes neither.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
insert into public.privacy_policies (org_id, hide_outside_hours) values ('a1000000-0000-0000-0000-000000000000', true);
insert into public.privacy_notices (org_id, version, body) values ('a1000000-0000-0000-0000-000000000000', 1, 'נוסח');

select pg_temp.as_user('00000000-0000-0000-0000-0000000001a3');
do $$ begin
  assert (select hide_outside_hours from public.privacy_policies), 'members read the policy';
  assert (select count(*) from public.privacy_notices) = 1, 'members read the notice';
  update public.privacy_policies set hide_outside_hours = false;
  assert (select hide_outside_hours from public.privacy_policies), 'a viewer cannot change the policy';
  begin
    insert into public.privacy_notices (org_id, version, body) values ('a1000000-0000-0000-0000-000000000000', 2, 'x');
    assert false, 'a viewer cannot publish a notice';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.privacy_private_set(true);
    assert false, 'only a driver switches to private';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The driver agrees in the portal and turns private on and off; the vehicle comes from the assignment.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a2');
insert into public.privacy_consents (org_id, driver_id, notice_version)
values ('a1000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 1);
do $$
declare
  v_row public.privacy_private_periods;
begin
  begin
    insert into public.privacy_consents (org_id, driver_id, notice_version, method)
    values ('a1000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 1, 'paper');
    assert false, 'a driver cannot record a paper consent';
  exception when insufficient_privilege then null;
  end;
  v_row := public.privacy_private_set(true);
  assert v_row.traccar_device_id = 501 and v_row.ended_at is null, 'private on for the assigned vehicle';
  assert (public.privacy_private_set(true)).id = v_row.id, 'switching on twice keeps one period';
  v_row := public.privacy_private_set(false);
  assert v_row.ended_at is not null, 'private off';
  begin
    insert into public.privacy_private_periods (org_id, driver_id) values ('a1000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001');
    assert false, 'periods change only through the functions';
  exception when insufficient_privilege then null;
  end;
  perform public.privacy_log_view(array[501], 'replay', now() - interval '1 day', now());
  assert (select count(*) from public.privacy_view_log) = 0, 'a driver does not read the view log';
end $$;

-- The owner reads the log and the consent; the other organization sees none of it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
do $$ begin
  assert (select count(*) from public.privacy_view_log where view = 'replay' and traccar_device_ids = array[501]) = 1, 'view recorded';
  assert (select count(*) from public.privacy_consents) = 1, 'owner reads consents';
  assert (select count(*) from public.privacy_private_periods where ended_at is not null) = 1, 'period recorded';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000001b1');
do $$ begin
  assert (select count(*) from public.privacy_policies) = 0, 'other org: no policy';
  assert (select count(*) from public.privacy_private_periods) = 0, 'other org: no periods';
  assert (select count(*) from public.privacy_view_log) = 0, 'other org: no log';
end $$;

-- Cleanup keeps two years by default.
select pg_temp.as_admin();
insert into public.privacy_view_log (org_id, traccar_device_ids, view, viewed_at)
values ('a1000000-0000-0000-0000-000000000000', array[501], 'live', now() - interval '800 days');
do $$ begin
  assert public.privacy_cleanup() = 1, 'old view log removed';
end $$;

\echo privacy.test.sql: all assertions passed
rollback;
