-- viper fleet: fuel rows that are checked, and import settings that are kept (ADM-18).
-- Idempotent.
--
-- fuel_transactions.reviewed_*: an anomaly someone looked at and found fine ("checked, OK"),
-- with who and when, so it stops asking for attention but stays on record.
-- fuel_import_profiles: per organization and fuel company, the column mapping of its file,
-- so the next file of the same company maps itself. Read with costs.read, written with
-- costs.write.

begin;

alter table public.fuel_transactions
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.fuel_import_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (length(btrim(provider)) between 1 and 60),
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

alter table public.fuel_import_profiles enable row level security;

drop policy if exists fuel_import_profiles_select on public.fuel_import_profiles;
create policy fuel_import_profiles_select on public.fuel_import_profiles for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('costs.read')));

drop policy if exists fuel_import_profiles_write on public.fuel_import_profiles;
create policy fuel_import_profiles_write on public.fuel_import_profiles for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('costs.write')))
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('costs.write')));

grant select, insert, update, delete on public.fuel_import_profiles to authenticated;

commit;
