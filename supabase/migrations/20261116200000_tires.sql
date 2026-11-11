-- viper fleet: tires over their life (OPS-07). Idempotent.
--
-- 1. vehicle_tires: a tire on a wheel position from its installation (date, km, price) until
--    it comes off (date, km, why). Cost per km = price / km done (src/common/fleet/tires.js).
-- 2. tire_tread_readings: tread depth in mm, per tire or per vehicle (the lowest wheel).
-- 3. A template item of a morning check can measure tread depth (measure = 'tread_depth'): its
--    number is copied into the readings when the check is saved, so the tread history fills
--    itself from the checks drivers already do.
-- Slow leaks are found in the app from the TPMS pressure trend (no table needed).
-- Who: maintenance.read reads, maintenance.write writes; readings from checks come in through
-- the trigger (security definer), whoever saved the check.

begin;

create table if not exists public.vehicle_tires (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  position text not null check (position ~ '^(fl|fr|rl|rr|[lr][2-9]|spare)$'),
  brand text,
  model text,
  size text,
  dot_code text,
  installed_at date not null default current_date,
  installed_odometer numeric check (installed_odometer is null or installed_odometer >= 0),
  cost numeric check (cost is null or cost >= 0),
  removed_at date,
  removed_odometer numeric check (removed_odometer is null or removed_odometer >= 0),
  removed_reason text check (removed_reason is null
    or removed_reason in ('worn', 'damaged', 'puncture', 'season', 'rotation', 'other')),
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (removed_at is null or removed_at >= installed_at),
  check (removed_odometer is null or installed_odometer is null
         or removed_odometer >= installed_odometer)
);

create index if not exists vehicle_tires_org_idx on public.vehicle_tires (org_id);
create index if not exists vehicle_tires_vehicle_idx on public.vehicle_tires (vehicle_id, installed_at desc);
-- One tire on a wheel at a time.
create unique index if not exists vehicle_tires_mounted_idx
  on public.vehicle_tires (vehicle_id, position) where removed_at is null;

create table if not exists public.tire_tread_readings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  tire_id uuid references public.vehicle_tires (id) on delete cascade,
  depth_mm numeric not null check (depth_mm >= 0 and depth_mm <= 30),
  measured_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'inspection')),
  inspection_id uuid references public.inspections (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists tire_tread_readings_org_idx on public.tire_tread_readings (org_id);
create index if not exists tire_tread_readings_vehicle_idx
  on public.tire_tread_readings (vehicle_id, measured_at desc);
create index if not exists tire_tread_readings_tire_idx on public.tire_tread_readings (tire_id);

alter table public.inspection_template_items add column if not exists measure text;
alter table public.inspection_template_items drop constraint if exists inspection_template_items_measure_check;
alter table public.inspection_template_items add constraint inspection_template_items_measure_check
  check (measure is null or (measure = 'tread_depth' and type = 'number_range'));

alter table public.vehicle_tires enable row level security;
alter table public.tire_tread_readings enable row level security;

drop policy if exists vehicle_tires_select on public.vehicle_tires;
create policy vehicle_tires_select on public.vehicle_tires for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('maintenance.read')));
drop policy if exists vehicle_tires_write on public.vehicle_tires;
create policy vehicle_tires_write on public.vehicle_tires for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('maintenance.write')))
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('maintenance.write'))
              and public.vehicle_in_my_org(vehicle_id));

drop policy if exists tire_tread_readings_select on public.tire_tread_readings;
create policy tire_tread_readings_select on public.tire_tread_readings for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('maintenance.read')));
drop policy if exists tire_tread_readings_write on public.tire_tread_readings;
create policy tire_tread_readings_write on public.tire_tread_readings for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('maintenance.write')))
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('maintenance.write'))
              and public.vehicle_in_my_org(vehicle_id));

grant select, insert, update, delete on public.vehicle_tires, public.tire_tread_readings to authenticated;

drop trigger if exists vehicle_tires_updated_at on public.vehicle_tires;
create trigger vehicle_tires_updated_at before update on public.vehicle_tires
  for each row execute function public.set_updated_at();
drop trigger if exists vehicle_tires_audit on public.vehicle_tires;
create trigger vehicle_tires_audit after insert or update or delete on public.vehicle_tires
  for each row execute function public.audit_row();

-- A check's tread depth item becomes a reading for the vehicle.
create or replace function public.tread_from_inspection()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  depth numeric;
  check_row public.inspections;
begin
  if new.template_item_id is null or new.value is null
     or not exists (select 1 from public.inspection_template_items
                     where id = new.template_item_id and measure = 'tread_depth') then
    return new;
  end if;
  begin
    depth := replace(new.value, ',', '.')::numeric;
  exception when others then
    return new;
  end;
  if depth < 0 or depth > 30 then
    return new;
  end if;
  select * into check_row from public.inspections where id = new.inspection_id;
  insert into public.tire_tread_readings (org_id, vehicle_id, depth_mm, measured_at, source, inspection_id)
  values (check_row.org_id, check_row.vehicle_id, depth,
          coalesce(check_row.finished_at, check_row.started_at), 'inspection', check_row.id);
  return new;
end;
$$;

revoke all on function public.tread_from_inspection() from public, anon, authenticated;

drop trigger if exists inspection_items_tread on public.inspection_items;
create trigger inspection_items_tread after insert on public.inspection_items
  for each row execute function public.tread_from_inspection();

commit;
