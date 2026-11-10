-- viper fleet: fuel fraud and theft checks, and idle cost in shekels (OPS-02). Idempotent.
--
-- Per organization: which checks are on (each one a switch with a one-line explanation in the
-- app), the fuel price per liter for the month (Israel publishes a regulated price each month;
-- it is entered here, not fetched), and the idle consumption in liters per hour.

begin;

create table if not exists public.org_fuel_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  rules jsonb not null default '{}',
  fuel_price numeric check (fuel_price is null or (fuel_price > 0 and fuel_price < 100)),
  fuel_price_month date,
  idle_liters_per_hour numeric not null default 1.0
    check (idle_liters_per_hour > 0 and idle_liters_per_hour < 20),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.org_fuel_settings enable row level security;

drop policy if exists org_fuel_settings_select on public.org_fuel_settings;
create policy org_fuel_settings_select on public.org_fuel_settings for select
  using (org_id = public.current_org_id() and public.has_permission('costs.read'));

drop policy if exists org_fuel_settings_write on public.org_fuel_settings;
create policy org_fuel_settings_write on public.org_fuel_settings for all
  using (org_id = public.current_org_id() and public.has_permission('costs.write'))
  with check (org_id = public.current_org_id() and public.has_permission('costs.write'));

grant select, insert, update on public.org_fuel_settings to authenticated;

drop trigger if exists org_fuel_settings_audit on public.org_fuel_settings;
create trigger org_fuel_settings_audit after insert or update or delete
  on public.org_fuel_settings for each row execute function public.audit_row();

commit;
