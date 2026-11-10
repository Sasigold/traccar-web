-- viper fleet: a test message to an alert recipient (ADM-27). Idempotent.
--
-- messaging_ready() says which channels can send (a key is set), without saying anything about
-- the key; alert_recipient_test() queues a test message to one of the organization's recipients,
-- for whoever manages alerts.

begin;

create or replace function public.messaging_ready()
returns table (channel text, ready boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c, public.messaging_secret(c) is not null
    from unnest(array['whatsapp', 'sms', 'email']) c
   where public.current_org_id() is not null;
$$;

revoke all on function public.messaging_ready() from public, anon;
grant execute on function public.messaging_ready() to authenticated;

create or replace function public.alert_recipient_test(p_recipient uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  recipient public.alert_recipients;
  delivery_id uuid;
begin
  if not public.has_permission('alerts.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into recipient from public.alert_recipients
   where id = p_recipient and org_id = public.current_org_id();
  if recipient.id is null then
    raise exception 'no such recipient' using errcode = 'P0002';
  end if;
  if public.messaging_secret(recipient.channel) is null then
    raise exception 'the channel is not connected' using errcode = '55000';
  end if;
  insert into public.notification_deliveries (org_id, kind, channel, address, subject, body)
  values (recipient.org_id, 'test', recipient.channel, recipient.address, 'viper fleet',
          'הודעת בדיקה מ-viper fleet: מכאן יגיעו ההתראות.')
  returning id into delivery_id;
  return delivery_id;
end;
$$;

revoke all on function public.alert_recipient_test(uuid) from public, anon;
grant execute on function public.alert_recipient_test(uuid) to authenticated;

commit;
