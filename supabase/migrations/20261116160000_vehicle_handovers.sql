-- viper fleet: handing a vehicle over and taking it back, signed (ISR-11). Idempotent.
--
-- A row per handover or return: the km, the fuel level, a photo of each side, the damage already
-- there, the driver's signature and, when someone hands it over, their name and signature. The
-- files live in the organization's inspections folder. Rows are never changed afterwards: a
-- mistake is corrected by the next handover.
-- Who: the driver records their own (inspections.write, as for the morning check); managers
-- with inspections.write record any; inspections.read (or being the driver) reads them.

begin;

create table if not exists public.vehicle_handovers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  kind text not null check (kind in ('handover', 'return')),
  odometer_km numeric check (odometer_km is null or odometer_km >= 0),
  fuel_percent integer check (fuel_percent is null or fuel_percent between 0 and 100),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 8),
  damages text,
  driver_signature_path text,
  giver_name text,
  giver_signature_path text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_handovers_org_idx on public.vehicle_handovers (org_id);
create index if not exists vehicle_handovers_vehicle_idx
  on public.vehicle_handovers (vehicle_id, created_at desc);

-- Whether a vehicle belongs to the caller's organization (a driver cannot read vehicles).
create or replace function public.vehicle_in_my_org(p_vehicle uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.vehicles
                  where id = p_vehicle and org_id = public.current_org_id())
$$;

revoke all on function public.vehicle_in_my_org(uuid) from public, anon;
grant execute on function public.vehicle_in_my_org(uuid) to authenticated;

alter table public.vehicle_handovers enable row level security;

drop policy if exists vehicle_handovers_select on public.vehicle_handovers;
create policy vehicle_handovers_select on public.vehicle_handovers for select
  using (org_id = (select public.current_org_id())
         and ((select public.has_permission('inspections.read'))
              or driver_id = (select public.my_driver_id())));

drop policy if exists vehicle_handovers_insert on public.vehicle_handovers;
create policy vehicle_handovers_insert on public.vehicle_handovers for insert
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('inspections.write'))
              and (not (select public.is_driver_role())
                   or driver_id = (select public.my_driver_id()))
              and public.vehicle_in_my_org(vehicle_id));

grant select, insert on public.vehicle_handovers to authenticated;

drop trigger if exists vehicle_handovers_audit on public.vehicle_handovers;
create trigger vehicle_handovers_audit after insert on public.vehicle_handovers
  for each row execute function public.audit_row();

commit;
