-- viper fleet: handling alerts (LIV-24). Idempotent.
--
-- A Traccar alert becomes a case once someone touches it: new, in progress or closed, with who
-- handles it, notes, and when it was taken and closed. The response time (taken - occurred) is
-- measured against the organization's target (SLA, minutes). Everyone who reads alerts may
-- handle them ("view and acknowledge"); deleting a case or changing the target needs
-- alerts.manage. The trigger, not the browser, records who took and closed a case and when.

begin;

create table if not exists public.org_alert_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  sla_minutes integer not null default 15 check (sla_minutes between 1 and 1440),
  updated_at timestamptz not null default now()
);

alter table public.org_alert_settings enable row level security;

drop policy if exists org_alert_settings_select on public.org_alert_settings;
create policy org_alert_settings_select on public.org_alert_settings for select
  using (org_id = public.current_org_id() and public.has_permission('alerts.read'));

drop policy if exists org_alert_settings_write on public.org_alert_settings;
create policy org_alert_settings_write on public.org_alert_settings for all
  using (org_id = public.current_org_id() and public.has_permission('alerts.manage'))
  with check (org_id = public.current_org_id() and public.has_permission('alerts.manage'));

grant select, insert, update on public.org_alert_settings to authenticated;

create table if not exists public.alert_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  traccar_event_id bigint not null,
  traccar_device_id integer not null,
  event_type text not null,
  occurred_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  taken_at timestamptz,
  taken_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, traccar_event_id)
);

create index if not exists alert_cases_occurred_idx
  on public.alert_cases (org_id, occurred_at desc);

alter table public.alert_cases enable row level security;

drop policy if exists alert_cases_select on public.alert_cases;
create policy alert_cases_select on public.alert_cases for select
  using (org_id = public.current_org_id() and public.has_permission('alerts.read'));

drop policy if exists alert_cases_insert on public.alert_cases;
create policy alert_cases_insert on public.alert_cases for insert
  with check (org_id = public.current_org_id() and public.has_permission('alerts.read'));

drop policy if exists alert_cases_update on public.alert_cases;
create policy alert_cases_update on public.alert_cases for update
  using (org_id = public.current_org_id() and public.has_permission('alerts.read'))
  with check (org_id = public.current_org_id() and public.has_permission('alerts.read'));

drop policy if exists alert_cases_delete on public.alert_cases;
create policy alert_cases_delete on public.alert_cases for delete
  using (org_id = public.current_org_id() and public.has_permission('alerts.manage'));

grant select, insert, update, delete on public.alert_cases to authenticated;

-- Who took and closed a case, and when, comes from the session; what happened (the event, its
-- time and vehicle) does not change once recorded.
create or replace function public.alert_cases_stamp()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' then
    if new.org_id <> old.org_id or new.traccar_event_id <> old.traccar_event_id
       or new.traccar_device_id <> old.traccar_device_id or new.occurred_at <> old.occurred_at
       or new.event_type <> old.event_type then
      raise exception 'the alert itself cannot change' using errcode = '42501';
    end if;
    -- The stamps are kept from before unless the status moves.
    new.taken_at := old.taken_at;
    new.taken_by := old.taken_by;
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
    new.created_at := old.created_at;
  else
    new.taken_at := null;
    new.taken_by := null;
    new.closed_at := null;
    new.closed_by := null;
    new.created_at := now();
  end if;
  new.updated_at := now();

  if new.status in ('in_progress', 'closed') and new.taken_at is null then
    new.taken_at := now();
    new.taken_by := auth.uid();
    new.assigned_to := coalesce(new.assigned_to, auth.uid());
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif new.status <> 'closed' then
    new.closed_at := null;
    new.closed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists alert_cases_stamp on public.alert_cases;
create trigger alert_cases_stamp before insert or update on public.alert_cases
  for each row execute function public.alert_cases_stamp();

drop trigger if exists alert_cases_audit on public.alert_cases;
create trigger alert_cases_audit after insert or update or delete
  on public.alert_cases for each row execute function public.audit_row();

-- Notes on a case: added, never edited; the author is the session.
create table if not exists public.alert_case_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.alert_cases (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists alert_case_notes_case_idx
  on public.alert_case_notes (case_id, created_at);

alter table public.alert_case_notes enable row level security;

drop policy if exists alert_case_notes_select on public.alert_case_notes;
create policy alert_case_notes_select on public.alert_case_notes for select
  using (org_id = public.current_org_id() and public.has_permission('alerts.read'));

drop policy if exists alert_case_notes_insert on public.alert_case_notes;
create policy alert_case_notes_insert on public.alert_case_notes for insert
  with check (
    org_id = public.current_org_id() and public.has_permission('alerts.read')
    and exists (select 1 from public.alert_cases c
                 where c.id = case_id and c.org_id = public.current_org_id())
  );

drop policy if exists alert_case_notes_delete on public.alert_case_notes;
create policy alert_case_notes_delete on public.alert_case_notes for delete
  using (org_id = public.current_org_id() and public.has_permission('alerts.manage'));

grant select, insert, delete on public.alert_case_notes to authenticated;

drop trigger if exists alert_case_notes_author on public.alert_case_notes;
create trigger alert_case_notes_author before insert on public.alert_case_notes
  for each row execute function public.set_row_author();

drop trigger if exists alert_case_notes_audit on public.alert_case_notes;
create trigger alert_case_notes_audit after insert or update or delete
  on public.alert_case_notes for each row execute function public.audit_row();

-- The fleet's areas now include alert handling.
create or replace function public.fleet_features()
returns text[]
language sql
stable
set search_path to 'public'
as $$
  select array_remove(array[
    case when to_regclass('public.dispatch_jobs') is not null then 'dispatch' end,
    case when to_regclass('public.work_orders') is not null then 'workOrders' end,
    case when to_regclass('public.inspections') is not null then 'inspections' end,
    case when to_regclass('public.incidents') is not null then 'incidents' end,
    case when to_regclass('public.vehicle_expenses') is not null then 'costs' end,
    case when to_regclass('public.driver_violations') is not null then 'safety' end,
    case when to_regclass('public.safety_procedures') is not null then 'safetyOfficer' end,
    case when to_regclass('public.pois') is not null then 'poi' end,
    case when to_regclass('public.document_alerts') is not null then 'alerts' end,
    case when to_regclass('public.api_keys') is not null then 'integrations' end,
    case when to_regclass('public.privacy_policies') is not null then 'privacy' end,
    case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'vehicles'
                         and column_name = 'asset_kind') then 'equipment' end,
    case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'vehicles'
                         and column_name = 'asset_kind') then 'sensors' end,
    case when to_regclass('public.ai_settings') is not null then 'ai' end,
    case when to_regclass('public.alert_cases') is not null then 'alertCases' end
  ], null)
$$;

revoke all on function public.fleet_features() from public, anon;
grant execute on function public.fleet_features() to authenticated;

commit;
