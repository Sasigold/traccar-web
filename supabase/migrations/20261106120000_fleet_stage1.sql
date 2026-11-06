-- viper fleet roadmap, stage 1: fleet details in the database, expiry alerts and a delivery queue.
--
-- Builds on the existing tables (vehicles, drivers, documents, document_types) instead of the
-- per-entity tables sketched in the roadmap: documents already covers vehicles, drivers and the
-- organization in one table. Additions only; idempotent.
--
-- Channels: alerts go out on WhatsApp (and in-app), reports by email. Until the provider keys are
-- configured, messages wait in notification_deliveries with status 'queued'; a sender (edge
-- function) picks them up later.

begin;

-- 1. Vehicle and driver details (stage 0 kept these in Traccar attributes).

alter table public.vehicles
  add column if not exists fuel_type text,
  add column if not exists ownership text,
  add column if not exists leasing_company text,
  add column if not exists leasing_end_date date,
  add column if not exists cost_center text;

alter table public.drivers
  add column if not exists license_classes text[] not null default '{}';

-- The old single-class column stays for compatibility; copy it into the list once.
update public.drivers
   set license_classes = array[license_class]
 where license_class is not null and license_class <> '' and license_classes = '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_fuel_type_check') then
    alter table public.vehicles add constraint vehicles_fuel_type_check
      check (fuel_type is null or fuel_type in ('petrol', 'diesel', 'hybrid', 'electric', 'gas'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicles_ownership_check') then
    alter table public.vehicles add constraint vehicles_ownership_check
      check (ownership is null or ownership in ('owned', 'leased', 'rented'));
  end if;
end $$;

-- 2. Permission keys for alerts.

insert into public.permissions (key, description) values
  ('alerts.read', 'View and acknowledge alerts'),
  ('alerts.manage', 'Manage alert recipients and delivery')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission) values
  ('admin', 'alerts.read'), ('admin', 'alerts.manage'),
  ('manager', 'alerts.read'), ('manager', 'alerts.manage'),
  ('dispatcher', 'alerts.read'),
  ('viewer', 'alerts.read')
on conflict do nothing;

-- 3. Who gets what, on which channel.

create table if not exists public.alert_recipients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  address text not null,
  -- document_expiry, maintenance, report
  kinds text[] not null default array['document_expiry'],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, channel, address)
);

-- 4. One alert per document, threshold and expiry date (re-arms when the date changes).

create table if not exists public.document_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  expires_at date not null,
  threshold_days integer not null,
  created_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  unique (document_id, expires_at, threshold_days)
);

create index if not exists document_alerts_open_idx
  on public.document_alerts (org_id, created_at desc) where acknowledged_at is null;

-- 5. Outgoing messages (WhatsApp / email). The sender updates status.

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  recipient_id uuid references public.alert_recipients (id) on delete set null,
  address text not null,
  subject text,
  body text not null,
  payload jsonb not null default '{}',
  document_alert_id uuid references public.document_alerts (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_deliveries_queue_idx
  on public.notification_deliveries (created_at) where status = 'queued';

-- 6. Fuel cards (roadmap 4.2).

create table if not exists public.vehicle_fuel_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  card_number text not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, card_number)
);

-- Timestamps and audit, same as the other fleet tables.

drop trigger if exists alert_recipients_updated_at on public.alert_recipients;
create trigger alert_recipients_updated_at before update on public.alert_recipients
  for each row execute function public.set_updated_at();

drop trigger if exists vehicle_fuel_cards_updated_at on public.vehicle_fuel_cards;
create trigger vehicle_fuel_cards_updated_at before update on public.vehicle_fuel_cards
  for each row execute function public.set_updated_at();

drop trigger if exists alert_recipients_audit on public.alert_recipients;
create trigger alert_recipients_audit after insert or update or delete on public.alert_recipients
  for each row execute function public.audit_row();

drop trigger if exists vehicle_fuel_cards_audit on public.vehicle_fuel_cards;
create trigger vehicle_fuel_cards_audit after insert or update or delete on public.vehicle_fuel_cards
  for each row execute function public.audit_row();

-- Row level security.

alter table public.alert_recipients enable row level security;
alter table public.document_alerts enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.vehicle_fuel_cards enable row level security;

drop policy if exists alert_recipients_all on public.alert_recipients;
create policy alert_recipients_all on public.alert_recipients for all
  using (org_id = public.current_org_id() and public.has_permission('alerts.manage'))
  with check (org_id = public.current_org_id() and public.has_permission('alerts.manage'));

drop policy if exists document_alerts_select on public.document_alerts;
create policy document_alerts_select on public.document_alerts for select
  using (org_id = public.current_org_id() and public.has_permission('alerts.read'));

-- Acknowledging is the only change users make; alerts themselves come from the daily job.
drop policy if exists document_alerts_ack on public.document_alerts;
create policy document_alerts_ack on public.document_alerts for update
  using (org_id = public.current_org_id() and public.has_permission('alerts.read'))
  with check (org_id = public.current_org_id() and public.has_permission('alerts.read'));

drop policy if exists notification_deliveries_select on public.notification_deliveries;
create policy notification_deliveries_select on public.notification_deliveries for select
  using (org_id = public.current_org_id() and public.has_permission('alerts.manage'));

drop policy if exists vehicle_fuel_cards_select on public.vehicle_fuel_cards;
create policy vehicle_fuel_cards_select on public.vehicle_fuel_cards for select
  using (org_id = public.current_org_id() and public.has_permission('vehicles.read'));

drop policy if exists vehicle_fuel_cards_write on public.vehicle_fuel_cards;
create policy vehicle_fuel_cards_write on public.vehicle_fuel_cards for all
  using (org_id = public.current_org_id() and public.has_permission('vehicles.write'))
  with check (org_id = public.current_org_id() and public.has_permission('vehicles.write'));

grant select, insert, update, delete on public.alert_recipients, public.vehicle_fuel_cards to authenticated;
grant select, update on public.document_alerts to authenticated;
grant select on public.notification_deliveries to authenticated;

-- Open alerts with their document, for the bell and the alerts list.
create or replace view public.document_alerts_open
with (security_invoker = true) as
select a.id, a.org_id, a.document_id, a.threshold_days, a.created_at,
       e.entity, e.document_type, e.label_he, e.label_en, e.title, e.expires_at,
       e.days_left, e.expiry_status, e.plate_number, e.traccar_device_id,
       e.driver_name, e.traccar_driver_id
  from public.document_alerts a
  join public.documents_expiring e on e.id = a.document_id and e.expires_at = a.expires_at
 where a.acknowledged_at is null;

grant select on public.document_alerts_open to authenticated;

-- 7. Daily expiry scan: 60 / 30 / 14 / 7 / 0 days before (roadmap 3.4).
--    Each document gets one alert per threshold; the most urgent threshold reached wins, so a
--    document added 5 days before expiry gets the 7-day alert, not five at once.

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
      label := format('%s של %s פג לפני %s ימים (%s)', rec.label_he, subject_name, -rec.days_left,
                      to_char(rec.expires_at, 'DD/MM/YYYY'));
    elsif rec.days_left = 0 then
      label := format('%s של %s פג היום', rec.label_he, subject_name);
    else
      label := format('%s של %s יפוג בעוד %s ימים (%s)', rec.label_he, subject_name, rec.days_left,
                      to_char(rec.expires_at, 'DD/MM/YYYY'));
    end if;

    insert into public.notification_deliveries
      (org_id, kind, channel, recipient_id, address, body, payload, document_alert_id)
    select rec.org_id, 'document_expiry', r.channel, r.id, r.address, label,
           jsonb_build_object('document_id', rec.id, 'days_left', rec.days_left,
                              'expires_at', rec.expires_at, 'threshold_days', threshold),
           alert_id
      from public.alert_recipients r
     where r.org_id = rec.org_id and r.active and r.channel = 'whatsapp'
       and 'document_expiry' = any (r.kinds);
  end loop;
  return created;
end;
$$;

revoke all on function public.generate_document_alerts(date) from public, anon, authenticated;

commit;

-- pg_cron lives outside the transaction: 04:00 UTC is 06:00 / 07:00 in Israel.
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'vf_document_alerts';
select cron.schedule('vf_document_alerts', '0 4 * * *', 'select public.generate_document_alerts()');
