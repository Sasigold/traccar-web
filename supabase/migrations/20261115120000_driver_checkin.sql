-- viper fleet: who drives each trip (SAF-02). Idempotent.
--
-- Each vehicle has a check-in code printed as a QR in the cabin. A driver scans it from the
-- driver area: driver_check_in() checks the code against the vehicle of the driver's own
-- organization, ends the open assignments of that vehicle and of that driver, and starts a new
-- one. Trips are then given to the driver by Traccar's driverUniqueId (iButton / RFID) first,
-- and by this assignment otherwise; trips with neither are "without a driver".

begin;

alter table public.vehicles add column if not exists checkin_code text;
update public.vehicles
   set checkin_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
 where checkin_code is null;
alter table public.vehicles
  alter column checkin_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

create or replace function public.driver_check_in(p_device integer, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public.my_driver_id();
  v_org uuid := public.current_org_id();
  v_vehicle public.vehicles;
begin
  if v_driver is null then
    raise exception 'not a driver' using errcode = '42501';
  end if;
  select * into v_vehicle from public.vehicles
   where org_id = v_org and traccar_device_id = p_device
     and checkin_code is not null and checkin_code = p_code;
  if v_vehicle.id is null then
    raise exception 'unknown vehicle or wrong code' using errcode = '42501';
  end if;
  update public.vehicle_driver_assignments
     set ends_at = now()
   where org_id = v_org and ends_at is null
     and (vehicle_id = v_vehicle.id or driver_id = v_driver);
  insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at)
  values (v_org, v_vehicle.id, v_driver, now());
  return jsonb_build_object('vehicle_id', v_vehicle.id, 'plate_number', v_vehicle.plate_number,
                            'traccar_device_id', v_vehicle.traccar_device_id);
end;
$$;

revoke all on function public.driver_check_in(integer, text) from public, anon;
grant execute on function public.driver_check_in(integer, text) to authenticated;

-- A manager prints a new code (the old QR stops working).
create or replace function public.vehicle_new_checkin_code(p_vehicle uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
begin
  if not public.has_permission('vehicles.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.vehicles set checkin_code = v_code
   where id = p_vehicle and org_id = public.current_org_id();
  if not found then
    raise exception 'unknown vehicle' using errcode = '42501';
  end if;
  return v_code;
end;
$$;

revoke all on function public.vehicle_new_checkin_code(uuid) from public, anon;
grant execute on function public.vehicle_new_checkin_code(uuid) to authenticated;

commit;
