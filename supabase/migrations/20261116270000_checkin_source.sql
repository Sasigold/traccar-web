-- viper fleet: a driver's check-in starts the working day (OPS-05). Idempotent.
--
-- An assignment says where it came from: 'checkin' when the driver scanned the vehicle's QR
-- (driver_check_in), null otherwise (a manager's assignment). The work hours report takes the
-- first check-in of a day as the start of that day, when it comes before the first ignition.

begin;

alter table public.vehicle_driver_assignments add column if not exists source text;
alter table public.vehicle_driver_assignments drop constraint if exists vehicle_driver_assignments_source_check;
alter table public.vehicle_driver_assignments
  add constraint vehicle_driver_assignments_source_check check (source is null or source in ('checkin'));

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
  insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at, source)
  values (v_org, v_vehicle.id, v_driver, now(), 'checkin');
  return jsonb_build_object('vehicle_id', v_vehicle.id, 'plate_number', v_vehicle.plate_number,
                            'traccar_device_id', v_vehicle.traccar_device_id);
end;
$$;

revoke all on function public.driver_check_in(integer, text) from public, anon;
grant execute on function public.driver_check_in(integer, text) to authenticated;

commit;
