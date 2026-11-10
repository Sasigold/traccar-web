-- viper fleet: automation rules (AI-05). Idempotent.
--
-- A rule is a template with parameters ("vehicle moves after 20:00"), what to do (notify,
-- open a work order, take the vehicle out of service, message the driver) and whether it is on.
-- The app shows each rule as a sentence and tests it on the last 7 days before it is turned on;
-- runs are logged in automation_runs. Managing rules needs alerts.manage; anyone who reads
-- alerts sees them and their runs.

begin;

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  template text not null
    check (template in ('afterHours', 'criticalFault', 'geofenceEnter', 'overspeed', 'idling')),
  params jsonb not null default '{}'::jsonb,
  actions text[] not null default array['notify']
    check (cardinality(actions) > 0
           and actions <@ array['notify', 'workOrder', 'outOfService', 'messageDriver']::text[]),
  active boolean not null default false,
  tested_at timestamptz,
  tested_matches integer,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_org_idx on public.automation_rules (org_id);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  traccar_event_id bigint,
  traccar_device_id integer,
  happened_at timestamptz not null default now(),
  actions_done text[] not null default '{}',
  note text
);

create index if not exists automation_runs_org_idx on public.automation_runs (org_id, happened_at desc);
create index if not exists automation_runs_rule_idx on public.automation_runs (rule_id);
create unique index if not exists automation_runs_once
  on public.automation_runs (rule_id, traccar_event_id) where traccar_event_id is not null;

alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists automation_rules_select on public.automation_rules;
create policy automation_rules_select on public.automation_rules for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('alerts.read')));

drop policy if exists automation_rules_write on public.automation_rules;
create policy automation_rules_write on public.automation_rules for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('alerts.manage')))
  with check (org_id = (select public.current_org_id()) and (select public.has_permission('alerts.manage')));

drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('alerts.read')));

drop policy if exists automation_runs_insert on public.automation_runs;
create policy automation_runs_insert on public.automation_runs for insert
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('alerts.read'))
              and exists (select 1 from public.automation_rules r
                           where r.id = rule_id and r.org_id = (select public.current_org_id())
                             and r.active));

grant select, insert, update, delete on public.automation_rules to authenticated;
grant select, insert on public.automation_runs to authenticated;

drop trigger if exists automation_rules_audit on public.automation_rules;
create trigger automation_rules_audit after insert or update or delete
  on public.automation_rules for each row execute function public.audit_row();

-- The fleet's areas now include automations.
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
    case when to_regclass('public.alert_cases') is not null then 'alertCases' end,
    case when to_regclass('public.pool_bookings') is not null then 'pool' end,
    case when to_regclass('public.automation_rules') is not null then 'automations' end
  ], null)
$$;

revoke all on function public.fleet_features() from public, anon;
grant execute on function public.fleet_features() to authenticated;

commit;
