-- viper fleet: pool vehicles (OPS-06). Idempotent.
--
-- A vehicle marked as a pool vehicle can be booked: who, from when to when, where to. A manager
-- approves; two approved bookings of one vehicle cannot overlap; a vehicle whose test
-- (vehicle_test document) has expired cannot be booked. On return, the odometer and a short
-- check are recorded. Anyone who reads vehicles may ask for a booking for themselves; managing
-- bookings needs pool.manage.

begin;

alter table public.vehicles add column if not exists pool boolean not null default false;

insert into public.permissions (key, description) values
  ('pool.manage', 'Approve and manage pool vehicle bookings')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission)
select r.role::public.app_role, 'pool.manage'
  from (values ('owner'), ('admin'), ('manager')) r(role)
 where exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                where t.typname = 'app_role' and e.enumlabel = r.role)
on conflict do nothing;

create extension if not exists btree_gist;

create table if not exists public.pool_bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  requested_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  destination text,
  purpose text,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'cancelled', 'returned')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  return_odometer_km numeric check (return_odometer_km is null or return_odometer_km >= 0),
  return_check_ok boolean,
  return_note text,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint pool_bookings_no_overlap exclude using gist (
    vehicle_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status = 'approved')
);

create index if not exists pool_bookings_org_idx on public.pool_bookings (org_id, starts_at);
create index if not exists pool_bookings_requested_by_idx on public.pool_bookings (requested_by);

alter table public.pool_bookings enable row level security;

drop policy if exists pool_bookings_select on public.pool_bookings;
create policy pool_bookings_select on public.pool_bookings for select
  using (org_id = (select public.current_org_id())
         and ((select public.has_permission('pool.manage'))
              or requested_by = auth.uid()
              or (select public.has_permission('vehicles.read'))));

drop policy if exists pool_bookings_insert on public.pool_bookings;
create policy pool_bookings_insert on public.pool_bookings for insert
  with check (org_id = (select public.current_org_id())
              and requested_by = auth.uid()
              and (select public.has_permission('vehicles.read')));

drop policy if exists pool_bookings_update on public.pool_bookings;
create policy pool_bookings_update on public.pool_bookings for update
  using (org_id = (select public.current_org_id())
         and ((select public.has_permission('pool.manage')) or requested_by = auth.uid()))
  with check (org_id = (select public.current_org_id()));

grant select, insert, update on public.pool_bookings to authenticated;

-- Who may move a booking where, and the stamps; a test that expired blocks the booking.
create or replace function public.pool_bookings_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  manager boolean := current_user <> 'authenticated' or public.has_permission('pool.manage');
  test_expiry date;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.vehicles v
                    where v.id = new.vehicle_id and v.org_id = new.org_id and v.pool) then
      raise exception 'not a pool vehicle' using errcode = '22023';
    end if;
    new.status := 'requested';
    new.decided_by := null;
    new.decided_at := null;
  else
    if new.vehicle_id <> old.vehicle_id or new.requested_by <> old.requested_by
       or new.org_id <> old.org_id then
      raise exception 'the booking itself cannot move' using errcode = '42501';
    end if;
    if new.status <> old.status then
      if new.status in ('approved', 'rejected') then
        if not manager then
          raise exception 'only a manager approves' using errcode = '42501';
        end if;
        new.decided_by := auth.uid();
        new.decided_at := now();
      elsif new.status = 'cancelled' and not manager and old.status not in ('requested', 'approved') then
        raise exception 'too late to cancel' using errcode = '42501';
      elsif new.status = 'returned' then
        if old.status <> 'approved' then
          raise exception 'only an approved booking is returned' using errcode = '22023';
        end if;
        new.returned_at := now();
      elsif new.status = 'requested' then
        raise exception 'a decided booking does not go back to requested' using errcode = '22023';
      end if;
    elsif not manager and (new.starts_at <> old.starts_at or new.ends_at <> old.ends_at)
          and old.status <> 'requested' then
      raise exception 'an approved booking is changed by a manager' using errcode = '42501';
    end if;
  end if;

  if new.status in ('requested', 'approved') then
    select max(d.expires_at) into test_expiry
      from public.documents d
     where d.vehicle_id = new.vehicle_id and d.document_type = 'vehicle_test';
    if test_expiry is not null and test_expiry < new.ends_at::date then
      raise exception 'the vehicle test expires before the booking ends' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pool_bookings_guard on public.pool_bookings;
create trigger pool_bookings_guard before insert or update on public.pool_bookings
  for each row execute function public.pool_bookings_guard();

drop trigger if exists pool_bookings_audit on public.pool_bookings;
create trigger pool_bookings_audit after insert or update or delete
  on public.pool_bookings for each row execute function public.audit_row();

-- The fleet's areas now include pool vehicles.
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
    case when to_regclass('public.pool_bookings') is not null then 'pool' end
  ], null)
$$;

revoke all on function public.fleet_features() from public, anon;
grant execute on function public.fleet_features() to authenticated;

commit;
