-- Driver area (ADM-09): a driver reads the check templates, fills in a check for their vehicle
-- and reports damage, and sees only their own.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a3000000-0000-0000-0000-000000000000', 'Drivers A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000003a1', 'a3000000-0000-0000-0000-000000000000', 'driver');
insert into public.vehicles (id, org_id, traccar_device_id) values
  ('e3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000000', 701);
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000003a1', 'Driver');
insert into public.inspection_templates (id, org_id, name) values
  ('7e000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000000', 'בדיקה יומית');
insert into public.inspection_template_items (org_id, template_id, label) values
  ('a3000000-0000-0000-0000-000000000000', '7e000000-0000-0000-0000-000000000001', 'צמיגים');

select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
do $$ begin
  assert (select count(*) from public.inspection_templates) = 1, 'the driver reads the template';
  assert (select count(*) from public.inspection_template_items) = 1, 'and its items';
  begin
    insert into public.inspection_templates (org_id, name) values ('a3000000-0000-0000-0000-000000000000', 'x');
    assert false, 'drivers do not edit templates';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.inspections (org_id, vehicle_id, driver_id, template_id, result, created_by)
values ('a3000000-0000-0000-0000-000000000000', 'e3000000-0000-0000-0000-000000000001',
        'd3000000-0000-0000-0000-000000000001', '7e000000-0000-0000-0000-000000000001', 'pass',
        '00000000-0000-0000-0000-0000000003a1');
insert into public.incidents (org_id, vehicle_id, driver_id, occurred_at, type, injuries, reported_by)
values ('a3000000-0000-0000-0000-000000000000', 'e3000000-0000-0000-0000-000000000001',
        'd3000000-0000-0000-0000-000000000001', now(), 'damage', false,
        '00000000-0000-0000-0000-0000000003a1');
do $$ begin
  assert (select count(*) from public.inspections) = 1, 'the driver sees their check';
  assert (select count(*) from public.incidents) = 1, 'and their report';
end $$;

\echo driver_area.test.sql: all assertions passed
rollback;
