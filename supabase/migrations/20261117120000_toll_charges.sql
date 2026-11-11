-- viper fleet: toll and parking statements are kept, with private use and cost centers (ISR-06).
-- Idempotent.
--
-- Until now a statement (Road 6, the Carmel tunnels, the fast lane, Pango, Cellopark) was matched
-- to trips in the browser and gone on reload. Now each charge is kept once (the same plate, time
-- and amount is the same charge, so importing a statement twice adds nothing), with:
-- * the vehicle, the matched trip's driver (Traccar's driver uniqueId) and the match status;
-- * private: a charge of private use, which the driver pays (out of the company's totals);
-- * cost_center: the vehicle's cost center when imported (vehicles.cost_center), editable.
-- Who: costs.read reads, costs.write imports and marks (as for fuel and expenses).

begin;

create table if not exists public.toll_charges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  traccar_device_id integer,
  plate text not null check (length(trim(plate)) between 1 and 20),
  charged_at timestamptz not null,
  amount numeric(10, 2) not null check (amount >= -100000 and amount <= 100000),
  operator text check (operator is null or length(operator) <= 100),
  place text check (place is null or length(place) <= 200),
  driver_unique_id text check (driver_unique_id is null or length(driver_unique_id) <= 100),
  status text not null default 'noTrip' check (status in ('matched', 'noTrip', 'unknownPlate')),
  private boolean not null default false,
  cost_center text check (cost_center is null or length(cost_center) <= 100),
  statement text check (statement is null or length(statement) <= 200),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, plate, charged_at, amount)
);

create index if not exists toll_charges_org_time on public.toll_charges (org_id, charged_at desc);

alter table public.toll_charges enable row level security;

drop policy if exists toll_charges_select on public.toll_charges;
create policy toll_charges_select on public.toll_charges for select to authenticated
  using (org_id = (select public.current_org_id())
         and ((select public.has_permission('costs.read')) or (select public.has_permission('costs.write'))));

drop policy if exists toll_charges_write on public.toll_charges;
create policy toll_charges_write on public.toll_charges for all to authenticated
  using (org_id = (select public.current_org_id()) and (select public.has_permission('costs.write')))
  with check (org_id = (select public.current_org_id()) and (select public.has_permission('costs.write')));

revoke all on public.toll_charges from anon;
grant select, insert, update, delete on public.toll_charges to authenticated;

drop trigger if exists toll_charges_audit on public.toll_charges;
create trigger toll_charges_audit after insert or update or delete
  on public.toll_charges for each row execute function public.audit_row();

commit;
