-- AI-05: rules are managed with alerts.manage, read with alerts.read; runs only for active rules
-- of the same organization, once per event.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('aa000000-0000-0000-0000-000000000000', 'Auto A'),
  ('ab000000-0000-0000-0000-000000000000', 'Auto B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-00000000aa01', 'aa000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000aa02', 'aa000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-00000000ab01', 'ab000000-0000-0000-0000-000000000000', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01');
insert into public.automation_rules (id, org_id, name, template, params, actions, active) values
  ('ac000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000000',
   'תנועה אחרי 20:00', 'afterHours', '{"after": "20:00"}', array['notify'], true),
  ('ac000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000000',
   'טיוטה', 'idling', '{}', array['notify'], false);
insert into public.automation_runs (org_id, rule_id, traccar_event_id)
values ('aa000000-0000-0000-0000-000000000000', 'ac000000-0000-0000-0000-000000000001', 77);
do $$ begin
  begin
    insert into public.automation_runs (org_id, rule_id, traccar_event_id)
    values ('aa000000-0000-0000-0000-000000000000', 'ac000000-0000-0000-0000-000000000001', 77);
    assert false, 'once per event';
  exception when unique_violation then null;
  end;
  begin
    insert into public.automation_runs (org_id, rule_id)
    values ('aa000000-0000-0000-0000-000000000000', 'ac000000-0000-0000-0000-000000000002');
    assert false, 'an inactive rule does not run';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.automation_rules (org_id, name, template, actions)
    values ('aa000000-0000-0000-0000-000000000000', 'x', 'afterHours', array['deleteEverything']);
    assert false, 'unknown action';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000aa02');
do $$ begin
  assert (select count(*) from public.automation_rules) = 0, 'a driver does not see the rules';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000ab01');
do $$ begin
  assert (select count(*) from public.automation_rules) = 0, 'another organization sees nothing';
  assert (select count(*) from public.automation_runs) = 0, 'nor the runs';
end $$;

rollback;
\echo 'automations.test.sql: all assertions passed'
