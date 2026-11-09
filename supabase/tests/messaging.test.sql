-- Sending queued messages: channel settings, keys in Vault, providers, retries, opt-outs.
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
  ('a0000000-0000-0000-0000-000000000000', 'Operator'),
  ('b0000000-0000-0000-0000-000000000000', 'Customer B');
insert into public.profiles (id, org_id, role, traccar_user_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000000', 'owner', 1),
  ('00000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000000', 'owner', 3);
delete from public.platform_admins;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');

-- ─── settings and keys ──────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  begin
    perform public.messaging_set_secret('whatsapp', 'token');
    assert false, 'a customer cannot set keys';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.messaging_channels) = 0, 'a customer reads no channels';
  assert (select count(*) from public.messaging_status()) = 0, 'nor their status';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.messaging_channels (channel, provider, enabled, sender, template)
values ('whatsapp', 'meta', true, '123456789', 'vf_alert'),
       ('sms', 'vonage', true, 'viperfleet', null);
do $$ begin
  perform public.messaging_set_secret('whatsapp', 'meta-token');
  perform public.messaging_set_secret('whatsapp', 'meta-token-2');
  perform public.messaging_set_secret('sms', 'key:secret');
  assert (select has_secret from public.messaging_status() where channel = 'whatsapp'), 'key set';
  assert not (select has_secret from public.messaging_status() where channel = 'email'), 'no email key';
  begin
    perform public.messaging_secret('whatsapp');
    assert false, 'the key is never readable through the API';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── queue ──────────────────────────────────────────────────────────────────
select pg_temp.as_admin();
insert into public.messaging_optouts (channel, address) values ('whatsapp', '972509999999');
insert into public.notification_deliveries (id, org_id, kind, channel, address, body) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 'test', 'whatsapp', '050-123-4567', E'שורה\tאחת\nושתיים'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', 'test', 'email', 'Ops@Example.com', 'email'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000000', 'test', 'whatsapp', '0509999999', 'opted out'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000000', 'test', 'sms', '0521112222', 'sms one'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000000', 'test', 'sms', '0523334444', 'sms two');

do $$
declare
  call record;
begin
  assert public.messaging_dispatch() = 3, 'whatsapp and two sms start; email has no channel';
  assert (select status from public.notification_deliveries where id = 'd0000000-0000-0000-0000-000000000002') = 'queued',
         'email waits for its channel';
  assert (select status from public.notification_deliveries where id = 'd0000000-0000-0000-0000-000000000003') = 'skipped',
         'opted-out numbers are skipped';

  select p.* into call from net.http_post_queue p
    join public.notification_deliveries n on n.request_id = p.id
   where n.id = 'd0000000-0000-0000-0000-000000000001';
  assert call.url = 'https://graph.facebook.com/v21.0/123456789/messages', 'WhatsApp Cloud API url';
  assert call.headers->>'Authorization' = 'Bearer meta-token-2', 'latest key';
  assert call.body->>'to' = '972501234567', 'international digits';
  assert call.body #>> '{template,name}' = 'vf_alert', 'template';
  assert call.body #>> '{template,components,0,parameters,0,text}' = 'שורה אחת ושתיים',
         'no line breaks or tabs in the parameter';

  select p.* into call from net.http_post_queue p
    join public.notification_deliveries n on n.request_id = p.id
   where n.id = 'd0000000-0000-0000-0000-000000000004';
  assert call.url = 'https://rest.nexmo.com/sms/json', 'Vonage url';
  assert call.body->>'api_key' = 'key' and call.body->>'api_secret' = 'secret', 'Vonage key pair';
end $$;

-- Answers: WhatsApp accepted, the first SMS refused by Vonage (status 2), the second accepted.
insert into net._http_response (id, status_code, content)
select n.request_id, 200,
       case n.id
         when 'd0000000-0000-0000-0000-000000000001' then '{"messages":[{"id":"wamid.A"}]}'
         when 'd0000000-0000-0000-0000-000000000004' then '{"messages":[{"status":"2","error-text":"Missing to"}]}'
         else '{"messages":[{"status":"0","message-id":"SMS-B"}]}'
       end
  from public.notification_deliveries n
 where n.request_id is not null;

do $$ begin
  assert public.messaging_collect() = 3, 'three answers read';
  assert (select status || ':' || provider_message_id from public.notification_deliveries
           where id = 'd0000000-0000-0000-0000-000000000001') = 'sent:wamid.A', 'WhatsApp sent';
  assert (select status || ':' || provider_message_id from public.notification_deliveries
           where id = 'd0000000-0000-0000-0000-000000000005') = 'sent:SMS-B', 'SMS sent';
  assert (select status = 'queued' and last_error = 'Missing to' and next_attempt_at > now()
            from public.notification_deliveries where id = 'd0000000-0000-0000-0000-000000000004'),
         'a refused SMS waits and retries with the provider error';
end $$;

-- After five attempts a message fails for good.
update public.notification_deliveries set attempts = 5, status = 'sending', request_id = 999999
 where id = 'd0000000-0000-0000-0000-000000000004';
insert into net._http_response (id, status_code, content) values (999999, 401, 'Unauthorized');
do $$ begin
  perform public.messaging_collect();
  assert (select status from public.notification_deliveries
           where id = 'd0000000-0000-0000-0000-000000000004') = 'failed', 'failed after 5 attempts';
  assert (select last_error from public.notification_deliveries
           where id = 'd0000000-0000-0000-0000-000000000004') like 'HTTP 401%', 'HTTP error kept';
end $$;

-- ─── expiry alerts reach every channel ──────────────────────────────────────
insert into public.document_types (key, label_he, label_en, applies_to)
values ('vehicle_test', 'טסט', 'Vehicle test', 'vehicle') on conflict do nothing;
insert into public.vehicles (id, org_id, traccar_device_id, plate_number)
values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 1, '12-345-67');
insert into public.documents (org_id, vehicle_id, document_type, expires_at)
values ('a0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'vehicle_test', current_date + 2);
insert into public.alert_recipients (org_id, name, channel, address) values
  ('a0000000-0000-0000-0000-000000000000', 'Ops WhatsApp', 'whatsapp', '0501234567'),
  ('a0000000-0000-0000-0000-000000000000', 'Ops SMS', 'sms', '0501234567'),
  ('a0000000-0000-0000-0000-000000000000', 'Ops email', 'email', 'ops@example.com');
do $$ begin
  assert public.generate_document_alerts() = 1, 'one alert';
  assert (select count(*) from public.notification_deliveries where kind = 'document_expiry') = 3,
         'queued for WhatsApp, SMS and email recipients';
  assert (select body from public.notification_deliveries where kind = 'document_expiry' limit 1)
       like 'טסט של 12-345-67 יפוג בעוד יומיים%', 'natural Hebrew day count';
  assert public.he_days(1) = 'יום אחד' and public.he_days(-3) = '3 ימים', 'he_days';
end $$;

-- A channel that cannot send (email here: no channel set up) never fills the batch: its old
-- deliveries stay queued while a newer SMS still goes out. (The earlier steps' queue is set aside.)
update public.notification_deliveries set status = 'skipped' where status = 'queued';
insert into public.notification_deliveries (id, org_id, kind, channel, address, body, created_at) values
  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000000', 'test', 'email', 'a@example.com', 'old', now() - interval '3 hours'),
  ('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000000', 'test', 'email', 'b@example.com', 'old', now() - interval '2 hours'),
  ('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000000', 'test', 'sms', '0525556666', 'new', now());
do $$ begin
  assert public.messaging_dispatch(2) >= 1, 'the SMS goes out despite older email waiting';
  assert (select status from public.notification_deliveries
           where id = 'd0000000-0000-0000-0000-000000000013') = 'sending', 'the new SMS is sending';
  assert (select count(*) from public.notification_deliveries
           where id in ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000012')
             and status = 'queued') = 2, 'the email deliveries still wait for their channel';
end $$;

rollback;
\echo 'messaging.test.sql: all assertions passed'
