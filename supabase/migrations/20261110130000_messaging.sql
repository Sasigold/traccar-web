-- viper fleet: sending the queued messages (OPS-01). Idempotent.
--
-- Until now alerts waited in notification_deliveries and nothing sent them. This adds:
-- 1. Channels for the whole service (WhatsApp, SMS, email): provider, sender, template. Provider
--    keys live in Supabase Vault (written through messaging_set_secret, never read back by the app).
-- 2. Providers: WhatsApp Business Platform (Meta Cloud API, an approved Hebrew template), Vonage
--    SMS, Resend email, and a generic webhook for any channel (an SMS gateway, Make, Zapier...).
-- 3. A dispatcher every minute (pg_net): opt-outs are skipped, failures retry with exponential
--    backoff (1, 2, 4, 8 minutes) and fail after 5 attempts; each message keeps its status, the
--    provider's message id and the last error.
-- 4. Expiry alerts are queued for every active recipient, not only WhatsApp ones, and read
--    naturally ("בעוד יומיים", "פג לפני יום אחד").
-- Nothing is sent until a channel is enabled and its key is set. Without pg_net nothing is
-- scheduled (a notice says so).

begin;

-- ─── 1. queue: SMS, provider ids, retries ───────────────────────────────────

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_channel_check
  check (channel in ('whatsapp', 'sms', 'email'));

alter table public.alert_recipients
  drop constraint if exists alert_recipients_channel_check;
alter table public.alert_recipients
  add constraint alert_recipients_channel_check check (channel in ('whatsapp', 'sms', 'email'));

alter table public.notification_deliveries
  add column if not exists request_id bigint,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists provider_message_id text;

-- Marketing messages need prior consent (Communications Law, section 30A); alerts do not.
alter table public.alert_recipients
  add column if not exists marketing_consent boolean not null default false;

create index if not exists notification_deliveries_queue
  on public.notification_deliveries (status, next_attempt_at);

-- ─── 2. channels and opt-outs ───────────────────────────────────────────────

create table if not exists public.messaging_channels (
  channel text primary key check (channel in ('whatsapp', 'sms', 'email')),
  provider text not null check (provider in ('meta', 'vonage', 'resend', 'webhook')),
  enabled boolean not null default false,
  -- whatsapp: phone number id · sms: sender name or number · email: "Name <from@domain>" ·
  -- webhook: the URL to post to.
  sender text,
  -- whatsapp: approved template name (one body parameter: the message text).
  template text,
  language text not null default 'he',
  updated_at timestamptz not null default now(),
  check (
    (channel = 'whatsapp' and provider in ('meta', 'webhook'))
    or (channel = 'sms' and provider in ('vonage', 'webhook'))
    or (channel = 'email' and provider in ('resend', 'webhook'))
  )
);

comment on table public.messaging_channels is
  'How each channel sends (provider, sender, template). The key is in Vault as messaging_<channel>.';

create table if not exists public.messaging_optouts (
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  address text not null,
  created_at timestamptz not null default now(),
  note text,
  primary key (channel, address)
);

alter table public.messaging_channels enable row level security;
alter table public.messaging_optouts enable row level security;

drop policy if exists messaging_channels_admin on public.messaging_channels;
create policy messaging_channels_admin on public.messaging_channels for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists messaging_optouts_admin on public.messaging_optouts;
create policy messaging_optouts_admin on public.messaging_optouts for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select, insert, update, delete on public.messaging_channels to authenticated;
grant select, insert, delete on public.messaging_optouts to authenticated;

-- Phone numbers as international digits (0501234567 → 972501234567); emails lower case.
create or replace function public.messaging_address(p_channel text, p_address text)
returns text
language sql
immutable
as $$
  select case
    when p_channel = 'email' then lower(trim(p_address))
    else regexp_replace(regexp_replace(p_address, '\D', '', 'g'), '^0', '972')
  end;
$$;

-- ─── 3. keys in Vault ───────────────────────────────────────────────────────

create or replace function public.messaging_secret(p_channel text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  value text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into value using 'messaging_' || p_channel;
  return value;
end;
$$;

revoke all on function public.messaging_secret(text) from public, anon, authenticated;

-- Platform admins set (or replace) a channel's key. It can never be read back through the API.
create or replace function public.messaging_set_secret(p_channel text, p_secret text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_channel not in ('whatsapp', 'sms', 'email') or coalesce(p_secret, '') = '' then
    raise exception 'invalid channel or key' using errcode = '22023';
  end if;
  if to_regclass('vault.secrets') is null then
    raise exception 'Supabase Vault is not available' using errcode = '55000';
  end if;
  execute 'select id from vault.secrets where name = $1 limit 1'
    into secret_id using 'messaging_' || p_channel;
  if secret_id is null then
    execute 'select vault.create_secret($1, $2)' using p_secret, 'messaging_' || p_channel;
  else
    execute 'select vault.update_secret($1, $2)' using secret_id, p_secret;
  end if;
end;
$$;

revoke all on function public.messaging_set_secret(text, text) from public, anon;
grant execute on function public.messaging_set_secret(text, text) to authenticated;

-- What the settings screen may know: whether each channel has a key.
create or replace function public.messaging_status()
returns table (channel text, has_secret boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c, public.is_platform_admin() and public.messaging_secret(c) is not null
    from unnest(array['whatsapp', 'sms', 'email']) c
   where public.is_platform_admin();
$$;

revoke all on function public.messaging_status() from public, anon;
grant execute on function public.messaging_status() to authenticated;

-- A test message to the caller's own address, through the normal queue.
create or replace function public.messaging_test(p_channel text, p_address text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  delivery_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.notification_deliveries (org_id, kind, channel, address, subject, body)
  values (public.current_org_id(), 'test', p_channel, p_address, 'viper fleet',
          'הודעת ניסיון מ-viper fleet: הערוץ מחובר.')
  returning id into delivery_id;
  return delivery_id;
end;
$$;

revoke all on function public.messaging_test(text, text) from public, anon;
grant execute on function public.messaging_test(text, text) to authenticated;

-- ─── 4. dispatcher ──────────────────────────────────────────────────────────

create or replace function public.messaging_request(
  p_channel public.messaging_channels,
  p_secret text,
  p_delivery public.notification_deliveries
)
returns table (url text, headers jsonb, body jsonb)
language plpgsql
stable
as $$
declare
  address text := public.messaging_address(p_delivery.channel, p_delivery.address);
begin
  if p_channel.provider = 'webhook' then
    return query select p_channel.sender,
      jsonb_build_object('Authorization', 'Bearer ' || p_secret, 'Content-Type', 'application/json'),
      jsonb_build_object('channel', p_delivery.channel, 'to', address, 'subject', p_delivery.subject,
                         'text', p_delivery.body, 'kind', p_delivery.kind, 'id', p_delivery.id);
  elsif p_channel.provider = 'meta' then
    return query select format('https://graph.facebook.com/v21.0/%s/messages', p_channel.sender),
      jsonb_build_object('Authorization', 'Bearer ' || p_secret, 'Content-Type', 'application/json'),
      jsonb_build_object(
        'messaging_product', 'whatsapp', 'to', address, 'type', 'template',
        'template', jsonb_build_object(
          'name', p_channel.template,
          'language', jsonb_build_object('code', p_channel.language),
          'components', jsonb_build_array(jsonb_build_object(
            'type', 'body',
            'parameters', jsonb_build_array(jsonb_build_object(
              'type', 'text',
              -- WhatsApp parameters take no line breaks or tabs.
              'text', regexp_replace(p_delivery.body, '[\n\t]+', ' ', 'g')))))));
  elsif p_channel.provider = 'vonage' then
    -- The key is "api_key:api_secret".
    return query select 'https://rest.nexmo.com/sms/json',
      jsonb_build_object('Content-Type', 'application/json'),
      jsonb_build_object('api_key', split_part(p_secret, ':', 1),
                         'api_secret', split_part(p_secret, ':', 2),
                         'from', p_channel.sender, 'to', address, 'text', p_delivery.body,
                         'type', 'unicode');
  elsif p_channel.provider = 'resend' then
    return query select 'https://api.resend.com/emails',
      jsonb_build_object('Authorization', 'Bearer ' || p_secret, 'Content-Type', 'application/json'),
      jsonb_build_object('from', p_channel.sender, 'to', jsonb_build_array(address),
                         'subject', coalesce(p_delivery.subject, 'viper fleet'),
                         'text', p_delivery.body);
  end if;
end;
$$;

create or replace function public.messaging_dispatch(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  delivery public.notification_deliveries;
  settings public.messaging_channels;
  secret text;
  request record;
  started integer := 0;
begin
  -- Only channels that can send now take part: deliveries for a channel that is off or has no key
  -- stay queued without filling every batch, so they never hold up the other channels.
  for delivery in
    select d.* from public.notification_deliveries d
     where d.status = 'queued' and coalesce(d.next_attempt_at, d.created_at) <= now()
       and d.channel in (select c.channel from public.messaging_channels c
                          where c.enabled and public.messaging_secret(c.channel) is not null)
     order by d.created_at
     limit p_limit
     for update of d skip locked
  loop
    if exists (select 1 from public.messaging_optouts o
                where o.channel = delivery.channel
                  and o.address = public.messaging_address(delivery.channel, delivery.address)) then
      update public.notification_deliveries set status = 'skipped', last_error = 'opted out'
       where id = delivery.id;
      continue;
    end if;

    select * into settings from public.messaging_channels
     where channel = delivery.channel and enabled;
    if not found then
      continue; -- waits until the channel is set up
    end if;
    secret := public.messaging_secret(delivery.channel);
    if secret is null then
      update public.notification_deliveries set last_error = 'no key for this channel'
       where id = delivery.id;
      continue;
    end if;

    select * into request from public.messaging_request(settings, secret, delivery);
    if request.url is null then
      -- A provider this version cannot send through: say so instead of keeping it queued.
      update public.notification_deliveries set status = 'failed', last_error = 'unsupported provider'
       where id = delivery.id;
      continue;
    end if;
    update public.notification_deliveries
       set status = 'sending',
           attempts = attempts + 1,
           request_id = net.http_post(url := request.url, body := request.body,
                                      headers := request.headers, timeout_milliseconds := 15000)
     where id = delivery.id;
    started := started + 1;
  end loop;
  return started;
end;
$$;

-- Read the providers' answers: sent, or retried later (1, 2, 4, 8 minutes), or failed after 5.
create or replace function public.messaging_collect()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  answer record;
  ok boolean;
  message_id text;
  failure text;
  finished integer := 0;
begin
  for answer in
    select n.id, n.attempts, c.provider, r.status_code, r.content, r.error_msg
      from public.notification_deliveries n
      join net._http_response r on r.id = n.request_id
      left join public.messaging_channels c on c.channel = n.channel
     where n.status = 'sending'
  loop
    ok := answer.status_code between 200 and 299;
    message_id := null;
    failure := null;
    begin
      if ok and answer.provider = 'meta' then
        message_id := answer.content::jsonb #>> '{messages,0,id}';
      elsif ok and answer.provider = 'resend' then
        message_id := answer.content::jsonb ->> 'id';
      elsif ok and answer.provider = 'vonage' then
        -- Vonage answers 200 with a per-message status: "0" is accepted.
        ok := (answer.content::jsonb #>> '{messages,0,status}') = '0';
        message_id := answer.content::jsonb #>> '{messages,0,message-id}';
        failure := answer.content::jsonb #>> '{messages,0,error-text}';
      end if;
    exception when others then
      null; -- a body that is not JSON keeps the HTTP verdict
    end;

    if ok then
      update public.notification_deliveries
         set status = 'sent', sent_at = now(), provider_message_id = message_id, last_error = null
       where id = answer.id;
    else
      failure := left(coalesce(failure, answer.error_msg,
                               format('HTTP %s: %s', answer.status_code, answer.content)), 500);
      update public.notification_deliveries
         set status = case when answer.attempts >= 5 then 'failed' else 'queued' end,
             next_attempt_at = now() + (2 ^ (answer.attempts - 1)) * interval '1 minute',
             last_error = failure
       where id = answer.id;
    end if;
    finished := finished + 1;
  end loop;

  -- No answer after 30 minutes (pg_net keeps answers for a few hours): try again.
  update public.notification_deliveries
     set status = case when attempts >= 5 then 'failed' else 'queued' end,
         last_error = 'no answer from the provider'
   where status = 'sending' and coalesce(next_attempt_at, created_at) < now() - interval '30 minutes'
     and not exists (select 1 from net._http_response r where r.id = request_id);
  return finished;
end;
$$;

revoke all on function public.messaging_request(public.messaging_channels, text, public.notification_deliveries)
  from public, anon, authenticated;
revoke all on function public.messaging_dispatch(integer) from public, anon, authenticated;
revoke all on function public.messaging_collect() from public, anon, authenticated;

-- ─── 5. expiry alerts for every channel, with natural day counts ────────────

create or replace function public.he_days(p_days integer)
returns text
language sql
immutable
as $$
  select case abs(p_days) when 1 then 'יום אחד' when 2 then 'יומיים'
              else abs(p_days)::text || ' ימים' end;
$$;

create or replace function public.generate_document_alerts(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  thresholds integer[] := array[60, 30, 14, 7, 0];
  created integer := 0;
  rec record;
  alert_id uuid;
  threshold integer;
  label text;
  subject_name text;
begin
  for rec in
    select d.id, d.org_id, d.expires_at, (d.expires_at - p_today) as days_left,
           t.label_he, v.plate_number, dr.full_name
      from public.documents d
      join public.document_types t on t.key = d.document_type
      left join public.vehicles v on v.id = d.vehicle_id
      left join public.drivers dr on dr.id = d.driver_id
     where d.expires_at is not null
       and d.expires_at - p_today <= 60
       and d.expires_at - p_today >= -30
  loop
    select min(x) into threshold from unnest(thresholds) x where x >= rec.days_left;
    if threshold is null then
      continue;
    end if;

    insert into public.document_alerts (org_id, document_id, expires_at, threshold_days)
    values (rec.org_id, rec.id, rec.expires_at, threshold)
    on conflict (document_id, expires_at, threshold_days) do nothing
    returning id into alert_id;

    if alert_id is null then
      continue;
    end if;
    created := created + 1;

    subject_name := coalesce(rec.plate_number, rec.full_name, '');
    if rec.days_left < 0 then
      label := format('%s של %s פג לפני %s (%s)', rec.label_he, subject_name,
                      public.he_days(rec.days_left), to_char(rec.expires_at, 'DD/MM/YYYY'));
    elsif rec.days_left = 0 then
      label := format('%s של %s פג היום', rec.label_he, subject_name);
    else
      label := format('%s של %s יפוג בעוד %s (%s)', rec.label_he, subject_name,
                      public.he_days(rec.days_left), to_char(rec.expires_at, 'DD/MM/YYYY'));
    end if;

    insert into public.notification_deliveries
      (org_id, kind, channel, recipient_id, address, subject, body, payload, document_alert_id)
    select rec.org_id, 'document_expiry', r.channel, r.id, r.address,
           format('תזכורת תוקף: %s', subject_name), label,
           jsonb_build_object('document_id', rec.id, 'days_left', rec.days_left,
                              'expires_at', rec.expires_at, 'threshold_days', threshold),
           alert_id
      from public.alert_recipients r
     where r.org_id = rec.org_id and r.active
       and 'document_expiry' = any (r.kinds);
  end loop;
  return created;
end;
$$;

revoke all on function public.generate_document_alerts(date) from public, anon, authenticated;

commit;

-- Every minute: send what is due, then read the answers. Only where pg_net is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    perform cron.unschedule(jobid) from cron.job where jobname = 'vf_messaging';
    perform cron.schedule('vf_messaging', '* * * * *',
                          'select public.messaging_collect(); select public.messaging_dispatch();');
  else
    raise notice 'pg_net is not available: queued messages are not sent';
  end if;
end;
$$;
