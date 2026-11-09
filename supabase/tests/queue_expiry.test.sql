-- The message queue (SEC-18): old queued messages expire instead of being sent late; finished
-- ones older than 180 days are removed; fresh ones are left alone.
\set ON_ERROR_STOP 1
begin;

insert into public.organizations (id, name) values ('a9000000-0000-0000-0000-000000000000', 'Queue A');
insert into public.notification_deliveries (id, org_id, kind, channel, address, body, status, created_at, expires_at) values
  ('e9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000000', 'document_expiry', 'whatsapp', '+972500000001', 'ישן', 'queued', now() - interval '30 days', now() - interval '28 days'),
  ('e9000000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000000', 'document_expiry', 'whatsapp', '+972500000001', 'חדש', 'queued', now(), default),
  ('e9000000-0000-0000-0000-000000000003', 'a9000000-0000-0000-0000-000000000000', 'document_expiry', 'whatsapp', '+972500000001', 'נשלח מזמן', 'sent', now() - interval '200 days', now() - interval '198 days');

do $$ begin
  assert public.messaging_expire() = 1, 'one expired';
  assert (select status || ':' || last_error from public.notification_deliveries
           where id = 'e9000000-0000-0000-0000-000000000001') = 'skipped:expired', 'marked expired';
  assert (select status from public.notification_deliveries
           where id = 'e9000000-0000-0000-0000-000000000002') = 'queued', 'the fresh one waits';
  assert public.messaging_cleanup() = 1, 'the old sent one is removed';
  assert (select count(*) from public.notification_deliveries
           where org_id = 'a9000000-0000-0000-0000-000000000000') = 2, 'two left';
end $$;

rollback;
\echo 'queue_expiry.test.sql: all assertions passed'
