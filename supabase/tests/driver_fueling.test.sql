-- ADM-18: a driver records a fueling on the vehicle assigned to them when it happened, once per id; a driver
-- without a vehicle, or someone who is not a driver, cannot.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('af100000-0000-0000-0000-000000000000', 'Fuel A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000af101', 'af100000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000af102', 'af100000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000af103', 'af100000-0000-0000-0000-000000000000', 'viewer');
insert into public.vehicles (id, org_id, traccar_device_id) values
  ('af100000-0000-0000-0000-0000000000a1', 'af100000-0000-0000-0000-000000000000', 201),
  ('af100000-0000-0000-0000-0000000000a2', 'af100000-0000-0000-0000-000000000000', 202);
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('af100000-0000-0000-0000-0000000000d1', 'af100000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000af101', 'דנה'),
  ('af100000-0000-0000-0000-0000000000d2', 'af100000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000af102', 'יוסי');
insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at, ends_at) values
  ('af100000-0000-0000-0000-000000000000', 'af100000-0000-0000-0000-0000000000a2',
   'af100000-0000-0000-0000-0000000000d1', now() - interval '60 days', now() - interval '10 days'),
  ('af100000-0000-0000-0000-000000000000', 'af100000-0000-0000-0000-0000000000a1',
   'af100000-0000-0000-0000-0000000000d1', now() - interval '10 days', null);

select pg_temp.as_user('00000000-0000-0000-0000-0000000af101');
do $$ begin
  perform public.driver_report_fueling('af100000-0000-0000-0000-0000000000f1', now(), 280, 40,
    45210, 'פז', 'af100000-0000-0000-0000-000000000000/fuel/r1.jpg');
  -- The offline queue sends it again.
  perform public.driver_report_fueling('af100000-0000-0000-0000-0000000000f1', now(), 280, 40);
  begin
    perform public.driver_report_fueling(gen_random_uuid(), now(), 0);
    assert false, 'a fueling has an amount';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.driver_report_fueling(gen_random_uuid(), now(), 100, null, null, null,
      'someone-else/fuel/r.jpg');
    assert false, 'the receipt is in the organization';
  exception when insufficient_privilege then null;
  end;
  -- Sent late from the outbox: 20 days ago the driver held the other vehicle.
  perform public.driver_report_fueling('af100000-0000-0000-0000-0000000000f2',
    now() - interval '20 days', 150, 20);
  assert public.fleet_file_permission('af100000-0000-0000-0000-000000000000/fuel/r1.jpg', true),
    'the driver uploads the receipt';
  assert not public.fleet_file_permission('af100000-0000-0000-0000-000000000000/fuel/r1.jpg', false),
    'the driver does not browse the receipts';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000af102');
do $$ begin
  perform public.driver_report_fueling(gen_random_uuid(), now(), 100);
  assert false, 'a driver without a vehicle';
exception when no_data_found then null;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000af103');
do $$ begin
  perform public.driver_report_fueling(gen_random_uuid(), now(), 100);
  assert false, 'not a driver';
exception when insufficient_privilege then null;
end $$;

reset role;
do $$
declare v_row public.fuel_transactions;
begin
  select * into v_row from public.fuel_transactions
   where id = 'af100000-0000-0000-0000-0000000000f1';
  assert (select count(*) from public.fuel_transactions
           where org_id = 'af100000-0000-0000-0000-000000000000') = 2, 'each fueling saved once';
  assert (select vehicle_id from public.fuel_transactions
           where id = 'af100000-0000-0000-0000-0000000000f2')
    = 'af100000-0000-0000-0000-0000000000a2', 'a late report goes to the vehicle held then';
  assert v_row.vehicle_id = 'af100000-0000-0000-0000-0000000000a1', 'on the current vehicle';
  assert v_row.driver_id = 'af100000-0000-0000-0000-0000000000d1', 'by the driver';
  assert v_row.source = 'driver' and v_row.unit_price = 7, 'priced per liter';
end $$;

rollback;
