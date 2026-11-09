-- viper fleet: what this database can do, for the app to show only working screens (ADM-08).
-- Idempotent.
--
--   fleet_features()   the fleet areas whose tables exist here (a database that has not had a
--                      migration yet hides the screen instead of showing a raw error)
--   messaging_ready()  per channel, whether sending is set up (keys in Vault): the outbox says so
--                      instead of leaving messages "waiting" with no reason. No secrets, only yes/no.

begin;

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
                         and column_name = 'asset_kind') then 'sensors' end
  ], null)
$$;

create or replace function public.messaging_ready()
returns table (channel text, ready boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.channel, coalesce(c.enabled, false) and public.messaging_secret(c.channel) is not null
    from public.messaging_channels c
$$;

revoke all on function public.fleet_features() from public, anon;
revoke all on function public.messaging_ready() from public, anon;
grant execute on function public.fleet_features() to authenticated;
grant execute on function public.messaging_ready() to authenticated;

commit;
