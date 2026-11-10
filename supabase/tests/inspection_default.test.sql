-- The morning check always has a checklist (ADM-11), and a critical failure stops the vehicle.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a8000000-0000-0000-0000-000000000000', 'Check A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000008a1', 'a8000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000008a2', 'a8000000-0000-0000-0000-000000000000', 'viewer');
insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('e8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000', 981, '81-111-11');

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a1');
do $$
declare
  v_first uuid := public.inspection_default_template();
  v_again uuid := public.inspection_default_template();
begin
  assert v_first = v_again, 'created once';
  assert (select count(*) from public.inspection_template_items where template_id = v_first) = 12,
    'the daily checklist';
  assert (select count(*) from public.inspection_template_items
           where template_id = v_first and critical) = 5, 'five critical items';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a2');
do $$ begin
  begin
    perform public.inspection_default_template();
    assert false, 'a viewer does not fill in checks';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A critical issue makes the vehicle "not for driving" until it is resolved.
reset role;
insert into public.issues (org_id, vehicle_id, source, severity, title)
values ('a8000000-0000-0000-0000-000000000000', 'e8000000-0000-0000-0000-000000000001', 'inspection', 'critical', 'בלמים ובלם יד');
do $$ begin
  assert (select reasons from public.vehicle_out_of_service
           where vehicle_id = 'e8000000-0000-0000-0000-000000000001') = 'בלמים ובלם יד', 'out of service';
  update public.issues set status = 'resolved' where vehicle_id = 'e8000000-0000-0000-0000-000000000001';
  assert not exists (select 1 from public.vehicle_out_of_service
                      where vehicle_id = 'e8000000-0000-0000-0000-000000000001'), 'back in service';
end $$;

rollback;
\echo 'inspection_default.test.sql: all assertions passed'
