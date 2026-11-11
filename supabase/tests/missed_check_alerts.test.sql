-- ADM-31: a vehicle taken today without a morning check alerts the chosen recipients once, after
-- the grace period, and only where a daily checklist is active.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('b1000000-0000-0000-0000-000000000000', 'Checks A'),
  ('b2000000-0000-0000-0000-000000000000', 'Checks B (no daily list)');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1000000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2000000-0000-0000-0000-000000000000', 'manager');
-- The default checklist may already exist for a new organization (inspection_default).
delete from public.inspection_templates
 where org_id in ('b1000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000000');
insert into public.inspection_templates (org_id, name, frequency, active) values
  ('b1000000-0000-0000-0000-000000000000', 'בדיקת בוקר', 'daily', true),
  ('b2000000-0000-0000-0000-000000000000', 'בדיקה שבועית', 'weekly', true);

insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('b1000000-0000-0000-0000-0000000000a1', 'b1000000-0000-0000-0000-000000000000', 9101, '11-111-11'),
  ('b1000000-0000-0000-0000-0000000000a2', 'b1000000-0000-0000-0000-000000000000', 9102, '22-222-22'),
  ('b1000000-0000-0000-0000-0000000000a3', 'b1000000-0000-0000-0000-000000000000', 9103, '33-333-33'),
  ('b2000000-0000-0000-0000-0000000000a1', 'b2000000-0000-0000-0000-000000000000', 9201, '44-444-44');
insert into public.drivers (id, org_id, full_name) values
  ('b1000000-0000-0000-0000-0000000000d1', 'b1000000-0000-0000-0000-000000000000', 'אבי'),
  ('b2000000-0000-0000-0000-0000000000d1', 'b2000000-0000-0000-0000-000000000000', 'בתיה');

-- 08:00 Israel time (06:00 UTC in November).
-- a1: taken at 07:00, no check -> alert. a2: taken at 07:00 and checked -> none.
-- a3: taken at 07:50 -> still within the 30 minutes. B: no daily checklist -> none.
insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at) values
  ('b1000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-0000000000a1', 'b1000000-0000-0000-0000-0000000000d1', '2026-11-17 05:00+00'),
  ('b1000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-0000000000a2', 'b1000000-0000-0000-0000-0000000000d1', '2026-11-17 05:00+00'),
  ('b1000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-0000000000a3', 'b1000000-0000-0000-0000-0000000000d1', '2026-11-17 05:50+00'),
  ('b2000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-0000000000a1', 'b2000000-0000-0000-0000-0000000000d1', '2026-11-17 05:00+00');
insert into public.inspections (org_id, vehicle_id, started_at) values
  ('b1000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-0000000000a2', '2026-11-17 05:05+00'),
  -- Yesterday's check does not count for a1.
  ('b1000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-0000000000a1', '2026-11-16 05:05+00');

insert into public.alert_recipients (org_id, name, channel, address, kinds) values
  ('b1000000-0000-0000-0000-000000000000', 'מנהל', 'whatsapp', '+972501111111', '{missed_check}'),
  ('b1000000-0000-0000-0000-000000000000', 'רק תוקפים', 'email', 'a@example.com', '{document_expiry}'),
  ('b2000000-0000-0000-0000-000000000000', 'מנהלת', 'whatsapp', '+972502222222', '{missed_check}');

do $$ begin
  assert public.generate_missed_check_alerts('2026-11-17 06:00+00') = 1, 'one vehicle alerted';
  assert (select count(*) from public.notification_deliveries where kind = 'missed_check') = 1,
    'one message, to the recipient that chose it';
  assert (select body from public.notification_deliveries where kind = 'missed_check')
    like '%11-111-11%אבי%07:00%', 'the message names the plate, the driver and the local time';
  -- Again on the next run: nothing new.
  assert public.generate_missed_check_alerts('2026-11-17 06:20+00') = 1, 'a3 after its grace period';
  assert public.generate_missed_check_alerts('2026-11-17 06:30+00') = 0, 'once per vehicle per day';
  assert (select count(*) from public.missed_check_alerts) = 2, 'two alerts';
end $$;

-- A manager of A reads A's alerts; B's manager reads none of them; nobody writes.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.missed_check_alerts) = 2, 'A reads its alerts';
  begin
    perform public.generate_missed_check_alerts();
    assert false, 'only the scheduler runs the generator';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.missed_check_alerts) = 0, 'B reads none of A''s alerts';
end $$;

reset role;
do $$ begin
  assert exists (select 1 from cron.job where jobname = 'vf_missed_checks'), 'scheduled';
end $$;

rollback;
\echo 'missed_check_alerts.test.sql: all assertions passed'
