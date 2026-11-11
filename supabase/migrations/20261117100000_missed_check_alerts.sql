-- viper fleet: a message to the manager when a vehicle went out without its morning check (ADM-31).
-- Idempotent.
--
-- The checks page already lists the vehicles that drove today without a check, but only for whoever
-- opens it. This runs on the server, every 10 minutes:
-- * Only in organizations with an active daily checklist (inspection_templates.frequency 'daily').
-- * A vehicle counts as "out" from the moment a driver took it today: a check-in (QR) or an
--   assignment that started today, in the organization's time zone (privacy_policies.timezone,
--   Asia/Jerusalem by default). Driving itself is in Traccar, which this database cannot read.
-- * 30 minutes after that, if the vehicle has no inspection since the start of the day, one
--   message per vehicle per day goes to every active recipient that chose 'missed_check'.

begin;

create table if not exists public.missed_check_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  day date not null,
  taken_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (vehicle_id, day)
);

alter table public.missed_check_alerts enable row level security;

drop policy if exists missed_check_alerts_read on public.missed_check_alerts;
create policy missed_check_alerts_read on public.missed_check_alerts
  for select to authenticated
  using (org_id = (select public.current_org_id()) and (select public.has_permission('inspections.read')));

revoke all on public.missed_check_alerts from anon;
revoke insert, update, delete on public.missed_check_alerts from authenticated;
grant select on public.missed_check_alerts to authenticated;

create index if not exists missed_check_alerts_org_day on public.missed_check_alerts (org_id, day desc);

create or replace function public.generate_missed_check_alerts(
  p_now timestamptz default now(),
  p_grace interval default interval '30 minutes'
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  created integer := 0;
  rec record;
  alert_id uuid;
  label text;
begin
  for rec in
    with orgs as (
      select o.id as org_id, coalesce(p.timezone, 'Asia/Jerusalem') as tz
        from public.organizations o
        left join public.privacy_policies p on p.org_id = o.id
       where exists (select 1 from public.inspection_templates t
                      where t.org_id = o.id and t.active and t.frequency = 'daily')
    ),
    taken as (
      -- The first time each vehicle was taken today.
      select distinct on (a.vehicle_id)
             a.org_id, a.vehicle_id, a.driver_id, a.starts_at, o.tz,
             (p_now at time zone o.tz)::date as day
        from public.vehicle_driver_assignments a
        join orgs o on o.org_id = a.org_id
       where (a.starts_at at time zone o.tz)::date = (p_now at time zone o.tz)::date
         and a.starts_at <= p_now - p_grace
       order by a.vehicle_id, a.starts_at
    )
    select k.*, v.plate_number, v.name as vehicle_name, d.full_name
      from taken k
      join public.vehicles v on v.id = k.vehicle_id
      left join public.drivers d on d.id = k.driver_id
     where not exists (
             select 1 from public.inspections i
              where i.vehicle_id = k.vehicle_id
                and i.started_at >= (k.day::timestamp at time zone k.tz))
  loop
    insert into public.missed_check_alerts (org_id, vehicle_id, driver_id, day, taken_at)
    values (rec.org_id, rec.vehicle_id, rec.driver_id, rec.day, rec.starts_at)
    on conflict (vehicle_id, day) do nothing
    returning id into alert_id;

    if alert_id is null then
      continue;
    end if;
    created := created + 1;

    label := format('הרכב %s יצא היום בלי בדיקת בוקר%s. נלקח ב-%s.',
                    coalesce(rec.plate_number, rec.vehicle_name, ''),
                    case when rec.full_name is not null then format(' (נהג: %s)', rec.full_name) else '' end,
                    to_char(rec.starts_at at time zone rec.tz, 'HH24:MI'));

    insert into public.notification_deliveries
      (org_id, kind, channel, recipient_id, address, subject, body, payload)
    select rec.org_id, 'missed_check', r.channel, r.id, r.address,
           format('בדיקת בוקר חסרה: %s', coalesce(rec.plate_number, rec.vehicle_name, '')), label,
           jsonb_build_object('vehicle_id', rec.vehicle_id, 'driver_id', rec.driver_id,
                              'day', rec.day, 'taken_at', rec.starts_at, 'alert_id', alert_id)
      from public.alert_recipients r
     where r.org_id = rec.org_id and r.active
       and 'missed_check' = any (r.kinds);
  end loop;
  return created;
end;
$$;

revoke all on function public.generate_missed_check_alerts(timestamptz, interval) from public, anon, authenticated;

commit;

-- Every 10 minutes. Where pg_cron is missing (a local test database), nothing is scheduled.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'cron' and p.proname = 'schedule') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'vf_missed_checks';
    perform cron.schedule('vf_missed_checks', '*/10 * * * *',
                          'select public.generate_missed_check_alerts();');
  else
    raise notice 'pg_cron is not available: missed checks are not alerted';
  end if;
end;
$$;
