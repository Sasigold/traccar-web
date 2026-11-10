-- Handling alerts (LIV-24): whoever reads alerts handles them; the trigger records who took and
-- closed a case and when; the alert itself and the stamps cannot be forged; another
-- organization sees nothing; deleting needs alerts.manage.
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
  ('a6000000-0000-0000-0000-000000000000', 'Alerts A'),
  ('b6000000-0000-0000-0000-000000000000', 'Alerts B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000006a1', 'a6000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000006a2', 'a6000000-0000-0000-0000-000000000000', 'dispatcher'),
  ('00000000-0000-0000-0000-0000000006a3', 'a6000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000006b1', 'b6000000-0000-0000-0000-000000000000', 'owner');

-- The dispatcher opens a case and takes it; the stamps come from the session, not the request.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a2');
insert into public.alert_cases
  (id, org_id, traccar_event_id, traccar_device_id, event_type, occurred_at, status,
   taken_at, taken_by, closed_at)
values
  ('c6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000', 501, 1,
   'alarm', now() - interval '20 minutes', 'in_progress',
   now() - interval '19 minutes', '00000000-0000-0000-0000-0000000006a1', now());
do $$
declare c public.alert_cases;
begin
  select * into c from public.alert_cases where id = 'c6000000-0000-0000-0000-000000000001';
  assert c.taken_by = '00000000-0000-0000-0000-0000000006a2', 'taken by the session';
  assert c.taken_at > now() - interval '1 minute', 'taken now, not when the request said';
  assert c.assigned_to = '00000000-0000-0000-0000-0000000006a2', 'assigned to who took it';
  assert c.closed_at is null, 'not closed';
end $$;

insert into public.alert_case_notes (org_id, case_id, body, created_by)
values ('a6000000-0000-0000-0000-000000000000', 'c6000000-0000-0000-0000-000000000001',
        'התקשרתי לנהג', '00000000-0000-0000-0000-0000000006a1');
do $$ begin
  assert (select created_by from public.alert_case_notes) = '00000000-0000-0000-0000-0000000006a2',
    'the author is the session';
  begin
    update public.alert_cases set occurred_at = now() where id = 'c6000000-0000-0000-0000-000000000001';
    assert false, 'the alert itself is fixed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.alert_case_notes (org_id, case_id, body)
    values ('a6000000-0000-0000-0000-000000000000', 'c6000000-0000-0000-0000-000000000001', '  ');
    assert false, 'an empty note';
  exception when check_violation then null;
  end;
  -- Closing stamps who and when; deleting needs alerts.manage (no error, nothing deleted).
  update public.alert_cases set status = 'closed' where id = 'c6000000-0000-0000-0000-000000000001';
  assert (select closed_by from public.alert_cases) = '00000000-0000-0000-0000-0000000006a2', 'closed by';
  delete from public.alert_cases;
  assert (select count(*) from public.alert_cases) = 1, 'the dispatcher cannot delete';
  -- Reopening clears the closing stamps and keeps when it was first taken.
  update public.alert_cases set status = 'in_progress';
  assert (select closed_at from public.alert_cases) is null, 'reopened';
  assert (select taken_at from public.alert_cases) is not null, 'still taken';
  begin
    insert into public.org_alert_settings (org_id, sla_minutes)
    values ('a6000000-0000-0000-0000-000000000000', 5);
    assert false, 'the target needs alerts.manage';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A driver (no alerts.read) and another organization see nothing and cannot add.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a3');
do $$ begin
  assert (select count(*) from public.alert_cases) = 0, 'the driver sees no cases';
  begin
    insert into public.alert_cases (org_id, traccar_event_id, traccar_device_id, event_type, occurred_at)
    values ('a6000000-0000-0000-0000-000000000000', 502, 1, 'alarm', now());
    assert false, 'the driver cannot open a case';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000006b1');
do $$ begin
  assert (select count(*) from public.alert_cases) = 0, 'another organization sees nothing';
  assert (select count(*) from public.alert_case_notes) = 0, 'nor its notes';
  begin
    insert into public.alert_case_notes (org_id, case_id, body)
    values ('b6000000-0000-0000-0000-000000000000', 'c6000000-0000-0000-0000-000000000001', 'x');
    assert false, 'a note on another organization''s case';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The owner sets the target and may delete.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
insert into public.org_alert_settings (org_id, sla_minutes)
values ('a6000000-0000-0000-0000-000000000000', 10);
delete from public.alert_cases;
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.alert_cases) = 0, 'the owner deleted the case';
  assert (select count(*) from public.alert_case_notes) = 0, 'with its notes';
  assert (select sla_minutes from public.org_alert_settings) = 10, 'the target';
end $$;

rollback;
\echo 'alert_cases.test.sql: all assertions passed'
