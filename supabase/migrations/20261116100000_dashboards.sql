-- viper fleet: dashboards in the fleet database (ARC-09). Idempotent.
--
-- Until now each person's dashboards lived in the Traccar user attribute `web.dashboard` (a PUT of
-- the whole user, about 3,000 characters next to every other attribute), and the organization
-- default in the server attribute `web.dashboardDefault` (a PUT of every server setting, which
-- could bring back what another administrator had changed meanwhile, and which every
-- organization on the server shared). Now:
--   dashboards          one row per person: their dashboard document, readable and writable
--                       only by that person, in their organization.
--   dashboard_defaults  one row per organization: the default that new members start from. Every
--                       member reads it; publishing needs users.manage.
-- `doc` is the compact document the app already encodes (src/dashboard/model/codec.js). The app
-- moves the Traccar copy over on the first save and then removes the attribute.

begin;

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 200000),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create index if not exists dashboards_org_idx on public.dashboards (org_id);

create table if not exists public.dashboard_defaults (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 200000),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.dashboards enable row level security;
alter table public.dashboard_defaults enable row level security;

drop policy if exists dashboards_own on public.dashboards;
create policy dashboards_own on public.dashboards for all
  using (profile_id = (select auth.uid()) and org_id = (select public.current_org_id()))
  with check (profile_id = (select auth.uid()) and org_id = (select public.current_org_id()));

drop policy if exists dashboard_defaults_select on public.dashboard_defaults;
create policy dashboard_defaults_select on public.dashboard_defaults for select
  using (org_id = (select public.current_org_id()));

drop policy if exists dashboard_defaults_write on public.dashboard_defaults;
create policy dashboard_defaults_write on public.dashboard_defaults for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('users.manage')))
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('users.manage')));

grant select, insert, update, delete on public.dashboards to authenticated;
grant select, insert, update, delete on public.dashboard_defaults to authenticated;

-- The server sets the time of every write, so a row is never older than what it holds.
create or replace function public.dashboards_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dashboards_touch on public.dashboards;
create trigger dashboards_touch before insert or update on public.dashboards
  for each row execute function public.dashboards_touch();

drop trigger if exists dashboard_defaults_touch on public.dashboard_defaults;
create trigger dashboard_defaults_touch before insert or update on public.dashboard_defaults
  for each row execute function public.dashboards_touch();

-- Publishing a default is an organization-wide change, so it is audited. A person's own layout
-- is not (it changes with every drag).
drop trigger if exists dashboard_defaults_audit on public.dashboard_defaults;
create trigger dashboard_defaults_audit after insert or update or delete
  on public.dashboard_defaults for each row execute function public.audit_row();

-- The fleet's areas now include dashboards.
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
    case when to_regclass('public.automation_rules') is not null then 'automations' end,
    case when to_regclass('public.dashboards') is not null then 'dashboards' end
  ], null)
$$;

revoke all on function public.fleet_features() from public, anon;
grant execute on function public.fleet_features() to authenticated;

commit;
