-- viper fleet: safer webhooks (SEC-15). Idempotent.
--
-- 1. Where: only https on port 443, to a public name; addresses inside private, loopback,
--    link-local or carrier ranges, localhost and internal names are refused, also when a stored
--    hook is changed. (A public name that resolves to a private address cannot be caught here;
--    the sender's network must not reach the database's neighbours.)
-- 2. What: each table sends a fixed list of fields, not the whole row (no phone numbers, ID
--    numbers, tracking tokens or notes).
-- 3. How: signed over "<timestamp>.<body>" with the timestamp in its own header, so a replayed
--    delivery can be refused by its age; the queue is fair, at most 20 deliveries per organization
--    each minute; only the kind of failure is kept (timeout, network, http 4xx/5xx), not the
--    remote answer; deliveries older than 30 days are removed.

begin;

create or replace function public.webhook_url_allowed(p_url text)
returns boolean
language plpgsql
immutable
as $$
declare
  parts text[];
  host text;
  port text;
  address inet;
begin
  parts := regexp_match(p_url, '^https://([^/?#@\s]+?)(?::(\d+))?(?:[/?#].*)?$');
  if parts is null then
    return false;
  end if;
  host := lower(parts[1]);
  port := parts[2];
  if port is not null and port <> '443' then
    return false;
  end if;
  if host = 'localhost' or host ~ '\.(localhost|local|internal|lan|home|corp|intranet)$'
     or host !~ '\.' then
    return false;
  end if;
  begin
    address := trim(both '[]' from host)::inet;
  exception when others then
    return true; -- a name, not an address
  end;
  return not (
       address << '10.0.0.0/8'::inet or address << '172.16.0.0/12'::inet
    or address << '192.168.0.0/16'::inet or address << '127.0.0.0/8'::inet
    or address << '169.254.0.0/16'::inet or address << '100.64.0.0/10'::inet
    or address << '0.0.0.0/8'::inet or address = '::1'::inet
    or address << 'fc00::/7'::inet or address << 'fe80::/10'::inet
  );
end;
$$;

create or replace function public.webhooks_check_url()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if not public.webhook_url_allowed(new.url) then
    raise exception 'the webhook address must be a public https address' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists webhooks_check_url on public.webhooks;
create trigger webhooks_check_url before insert or update of url on public.webhooks
  for each row execute function public.webhooks_check_url();

-- Hooks already pointing inside are switched off, not deleted.
update public.webhooks set active = false where active and not public.webhook_url_allowed(url);

-- 2. The fields each table sends.
create or replace function public.webhook_payload(p_table text, p_row jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(p_row)
   where key = any (case p_table
     when 'dispatch_jobs' then array['id', 'number', 'title', 'type', 'status', 'priority',
       'poi_id', 'address', 'latitude', 'longitude', 'vehicle_id', 'driver_id', 'scheduled_at',
       'window_end', 'started_at', 'arrived_at', 'completed_at', 'created_at', 'updated_at']
     when 'incidents' then array['id', 'number', 'type', 'severity', 'status', 'injuries',
       'fault', 'occurred_at', 'vehicle_id', 'driver_id', 'created_at', 'updated_at']
     when 'work_orders' then array['id', 'number', 'title', 'type', 'status', 'vehicle_id',
       'vendor_id', 'opened_at', 'closed_at', 'total_cost', 'created_at', 'updated_at']
     when 'issues' then array['id', 'title', 'severity', 'status', 'source', 'vehicle_id',
       'created_at', 'updated_at']
     when 'inspections' then array['id', 'result', 'vehicle_id', 'driver_id', 'started_at',
       'completed_at', 'created_at']
     when 'document_alerts' then array['id', 'document_id', 'threshold_days', 'expires_at',
       'created_at']
     when 'driver_violations' then array['id', 'type', 'status', 'occurred_at', 'driver_id',
       'vehicle_id', 'points', 'fine_amount', 'created_at', 'updated_at']
     else array['id']
   end);
$$;

create or replace function public.queue_webhooks()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  event_name text;
  row_data jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    event_name := tg_table_name || '.insert';
  elsif row_data ? 'status' and (to_jsonb(old) ->> 'status') is distinct from (row_data ->> 'status') then
    event_name := tg_table_name || '.status';
  else
    event_name := tg_table_name || '.update';
  end if;
  insert into public.webhook_deliveries (org_id, webhook_id, event, payload)
  select w.org_id, w.id, event_name,
         jsonb_build_object('event', event_name, 'occurred_at', now(),
                            'data', public.webhook_payload(tg_table_name, row_data))
    from public.webhooks w
   where w.active and w.org_id = new.org_id
     and (event_name = any (w.events) or (tg_table_name || '.*') = any (w.events));
  return null;
end;
$$;

-- 3. Sending.
create or replace function public.webhook_failure(p_code integer, p_error text)
returns text
language sql
immutable
as $$
  select case
    when p_code between 200 and 299 then null
    when p_code between 400 and 499 then 'http_4xx'
    when p_code between 500 and 599 then 'http_5xx'
    when p_code is not null then 'http_other'
    when p_error ilike '%timeout%' or p_error ilike '%timed out%' then 'timeout'
    else 'network'
  end;
$$;

create or replace function public.send_webhooks()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  delivery record;
  body text;
  stamp text;
  sent integer := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return 0;
  end if;

  update public.webhook_deliveries d
     set status = case when r.status_code between 200 and 299 then 'sent'
                       when d.attempts >= 5 then 'failed' else 'queued' end,
         response_code = case when r.status_code between 200 and 299 then r.status_code end,
         error = public.webhook_failure(r.status_code, r.error_msg),
         sent_at = case when r.status_code between 200 and 299 then now() end,
         next_attempt_at = now() + make_interval(mins => power(2, d.attempts)::int)
    from net._http_response r
   where d.status = 'sending' and r.id = d.request_id;

  for delivery in
    select * from (
      select d.*, w.url, w.secret,
             row_number() over (partition by d.org_id order by d.next_attempt_at) as place
        from public.webhook_deliveries d
        join public.webhooks w on w.id = d.webhook_id
       where d.status = 'queued' and d.next_attempt_at <= now() and w.active
         and public.webhook_url_allowed(w.url)
    ) due
     where place <= 20
     order by next_attempt_at
     limit 100
  loop
    body := delivery.payload::text;
    stamp := extract(epoch from now())::bigint::text;
    update public.webhook_deliveries
       set status = 'sending',
           attempts = attempts + 1,
           request_id = net.http_post(
             url := delivery.url,
             body := delivery.payload,
             headers := jsonb_build_object(
               'Content-Type', 'application/json',
               'X-ViperFleet-Event', delivery.event,
               'X-ViperFleet-Delivery', delivery.id::text,
               'X-ViperFleet-Timestamp', stamp,
               'X-ViperFleet-Signature',
               'v1=' || encode(hmac(stamp || '.' || body, delivery.secret, 'sha256'), 'hex')),
             timeout_milliseconds := 10000)
     where id = delivery.id and status = 'queued';
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke all on function public.send_webhooks() from public, anon, authenticated;

create or replace function public.webhook_cleanup()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with removed as (
    delete from public.webhook_deliveries
     where status in ('sent', 'failed') and created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from removed;
$$;

revoke all on function public.webhook_cleanup() from public, anon, authenticated;

commit;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'vf_webhook_cleanup';
  perform cron.schedule('vf_webhook_cleanup', '40 3 * * *', 'select public.webhook_cleanup()');
end;
$$;
