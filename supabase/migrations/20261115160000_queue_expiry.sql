-- viper fleet: the message queue does not keep old alerts for later (SEC-18). Idempotent.
--
-- A message waits at most two days. Whatever was queued before a channel was connected, and is
-- older than that, is skipped as expired instead of arriving all at once on the day a provider is
-- set up. Finished messages are kept 180 days, then removed.

begin;

alter table public.notification_deliveries
  add column if not exists expires_at timestamptz;
update public.notification_deliveries
   set expires_at = created_at + interval '2 days'
 where expires_at is null;
alter table public.notification_deliveries
  alter column expires_at set default now() + interval '2 days';

create or replace function public.messaging_expire()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with expired as (
    update public.notification_deliveries
       set status = 'skipped', last_error = 'expired'
     where status = 'queued' and expires_at is not null and expires_at < now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

create or replace function public.messaging_cleanup()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with removed as (
    delete from public.notification_deliveries
     where status in ('sent', 'failed', 'skipped') and created_at < now() - interval '180 days'
    returning 1
  )
  select count(*)::integer from removed;
$$;

revoke all on function public.messaging_expire() from public, anon, authenticated;
revoke all on function public.messaging_cleanup() from public, anon, authenticated;

commit;

-- Every minute the expired go first; every night the old are removed.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'vf_messaging';
    perform cron.schedule('vf_messaging', '* * * * *',
      'select public.messaging_expire(); select public.messaging_collect(); select public.messaging_dispatch();');
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'vf_messaging_cleanup';
  perform cron.schedule('vf_messaging_cleanup', '20 3 * * *', 'select public.messaging_cleanup()');
end;
$$;
