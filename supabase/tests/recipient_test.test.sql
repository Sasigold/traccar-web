-- ADM-27: a manager tests a recipient of their organization once the channel is connected; others
-- cannot, and nobody learns the key.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('ad000000-0000-0000-0000-000000000000', 'Recipients A'),
  ('ae000000-0000-0000-0000-000000000000', 'Recipients B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-00000000ad01', 'ad000000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-00000000ad02', 'ad000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-00000000ae01', 'ae000000-0000-0000-0000-000000000000', 'manager');
insert into public.alert_recipients (id, org_id, name, channel, address) values
  ('af000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000000', 'דנה', 'whatsapp', '+972501234567');

-- Before a key is set: ready is false and the test is refused.
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad01');
do $$ begin
  assert not (select ready from public.messaging_ready() where channel = 'whatsapp'), 'not ready';
  begin
    perform public.alert_recipient_test('af000000-0000-0000-0000-000000000001');
    assert false, 'not connected';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;

reset role;
insert into vault.secrets (name, secret) values ('messaging_whatsapp', 'secret-key')
on conflict (name) do update set secret = excluded.secret;

select pg_temp.as_user('00000000-0000-0000-0000-00000000ad01');
do $$ begin
  assert (select ready from public.messaging_ready() where channel = 'whatsapp'), 'ready';
  perform public.alert_recipient_test('af000000-0000-0000-0000-000000000001');
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000ad02');
do $$ begin
  perform public.alert_recipient_test('af000000-0000-0000-0000-000000000001');
  assert false, 'a viewer cannot test';
exception when insufficient_privilege then null;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000ae01');
do $$ begin
  perform public.alert_recipient_test('af000000-0000-0000-0000-000000000001');
  assert false, 'not another organization''s recipient';
exception when no_data_found then null;
end $$;

reset role;
do $$ begin
  assert (select count(*) from public.notification_deliveries where kind = 'test') = 1, 'one test queued';
end $$;

rollback;
\echo 'recipient_test.test.sql: all assertions passed'
