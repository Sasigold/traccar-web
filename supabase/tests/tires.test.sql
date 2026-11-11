-- OPS-07: tires over their life: one tire per wheel, readings from morning checks, and only
-- maintenance writes them.
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
    when 'owner' then p_permission in ('maintenance.read', 'maintenance.write', 'inspections.write')
    when 'manager' then p_permission in ('maintenance.read', 'inspections.write')
    else p_permission = 'inspections.write' end
$$;

insert into public.organizations (id, name) values
  ('7a000000-0000-0000-0000-000000000000', 'Fleet A'),
  ('7b000000-0000-0000-0000-000000000000', 'Fleet B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000007a1', '7a000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000007a2', '7a000000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-0000000007b1', '7b000000-0000-0000-0000-000000000000', 'owner');
insert into public.vehicles (id, org_id, traccar_device_id) values
  ('7a000000-0000-0000-0000-0000000000c1', '7a000000-0000-0000-0000-000000000000', 71),
  ('7b000000-0000-0000-0000-0000000000c1', '7b000000-0000-0000-0000-000000000000', 72);
insert into public.inspection_templates (id, org_id, name) values
  ('7a000000-0000-0000-0000-0000000000e1', '7a000000-0000-0000-0000-000000000000', 'Morning');
insert into public.inspection_template_items (id, org_id, template_id, label, type, min_value, measure) values
  ('7a000000-0000-0000-0000-0000000000f1', '7a000000-0000-0000-0000-000000000000',
   '7a000000-0000-0000-0000-0000000000e1', 'עומק חריץ (מ"מ)', 'number_range', 1.6, 'tread_depth'),
  ('7a000000-0000-0000-0000-0000000000f2', '7a000000-0000-0000-0000-000000000000',
   '7a000000-0000-0000-0000-0000000000e1', 'שמן', 'pass_fail', null, null);

do $$ begin
  begin
    insert into public.inspection_template_items (org_id, template_id, label, type, measure)
    values ('7a000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-0000000000e1', 'x',
            'pass_fail', 'tread_depth');
    assert false, 'only a number item measures tread';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000007a1');
do $$ begin
  insert into public.vehicle_tires (org_id, vehicle_id, position, installed_odometer, cost)
  values ('7a000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-0000000000c1', 'fl', 10000, 600);
  begin
    insert into public.vehicle_tires (org_id, vehicle_id, position)
    values ('7a000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-0000000000c1', 'fl');
    assert false, 'one tire on a wheel at a time';
  exception when unique_violation then null;
  end;
  update public.vehicle_tires set removed_at = current_date, removed_odometer = 60000, removed_reason = 'worn'
   where position = 'fl';
  insert into public.vehicle_tires (org_id, vehicle_id, position)
  values ('7a000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-0000000000c1', 'fl');
  assert (select count(*) from public.vehicle_tires) = 2, 'a removed tire leaves room for the next';
  begin
    insert into public.vehicle_tires (org_id, vehicle_id, position)
    values ('7a000000-0000-0000-0000-000000000000', '7b000000-0000-0000-0000-0000000000c1', 'rr');
    assert false, 'not on another organization''s vehicle';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A morning check's tread depth becomes a reading, whoever saved it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000007a2');
do $$
declare
  check_id uuid;
begin
  assert (select count(*) from public.vehicle_tires) = 2, 'maintenance.read reads the tires';
  begin
    insert into public.vehicle_tires (org_id, vehicle_id, position)
    values ('7a000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-0000000000c1', 'rr');
    assert false, 'maintenance.read does not write';
  exception when insufficient_privilege then null;
  end;
  insert into public.inspections (org_id, vehicle_id, template_id, result)
  values ('7a000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-0000000000c1',
          '7a000000-0000-0000-0000-0000000000e1', 'pass')
  returning id into check_id;
  insert into public.inspection_items (org_id, inspection_id, template_item_id, label, type, value, passed) values
    ('7a000000-0000-0000-0000-000000000000', check_id, '7a000000-0000-0000-0000-0000000000f1', 'עומק', 'number_range', '4,5', true),
    ('7a000000-0000-0000-0000-000000000000', check_id, '7a000000-0000-0000-0000-0000000000f2', 'שמן', 'pass_fail', 'ok', true);
  assert (select count(*) from public.tire_tread_readings) = 1, 'one reading, from the tread item only';
  assert (select depth_mm from public.tire_tread_readings) = 4.5, 'with a comma as the decimal point';
  assert (select source from public.tire_tread_readings) = 'inspection', 'marked as from the check';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000007b1');
do $$ begin
  assert (select count(*) from public.vehicle_tires) = 0, 'another organization sees no tires';
  assert (select count(*) from public.tire_tread_readings) = 0, 'nor readings';
end $$;

rollback;
\echo 'tires.test.sql: all assertions passed'
