-- viper fleet: customer tracking links stop with the job (review item SEC-03). Idempotent.
--
-- A tracking link is a Traccar share token. When a job is done, failed or cancelled the link is
-- removed from the job (so nobody resends it) and its recorded expiry is cut to now. The token
-- itself stays valid in Traccar until its own expiry, which the UI now caps at 12 hours.

begin;

create or replace function public.dispatch_job_close_tracking()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status in ('done', 'failed', 'cancelled')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.tracking_link := null;
    new.tracking_expires_at := least(coalesce(new.tracking_expires_at, now()), now());
  end if;
  return new;
end;
$$;

drop trigger if exists dispatch_jobs_close_tracking on public.dispatch_jobs;
create trigger dispatch_jobs_close_tracking before insert or update on public.dispatch_jobs
  for each row execute function public.dispatch_job_close_tracking();

-- Jobs that are already closed keep no link.
update public.dispatch_jobs
   set tracking_link = null,
       tracking_expires_at = least(coalesce(tracking_expires_at, now()), now())
 where status in ('done', 'failed', 'cancelled') and tracking_link is not null;

commit;
