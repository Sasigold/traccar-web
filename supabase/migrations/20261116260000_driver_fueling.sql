-- ADM-18: a driver records a fueling (with the receipt's photo) from the driver portal, on the
-- vehicle assigned to them now. Managers keep writing fuel rows with costs.write; a driver has
-- no costs permission, so the row goes in through one function that checks who and which car.
begin;

alter table public.fuel_transactions add column if not exists receipt_path text;

alter table public.fuel_transactions drop constraint if exists fuel_transactions_source_check;
alter table public.fuel_transactions
  add constraint fuel_transactions_source_check check (source in ('import', 'manual', 'driver'));

-- Receipts live under <org_id>/fuel/...: written with costs.write, or by a driver (their own
-- fueling, through the portal); read with the costs permissions.
create or replace function public.fleet_file_permission(p_name text, p_write boolean)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (storage.foldername(p_name))[1] = public.current_org_id()::text
     and case (storage.foldername(p_name))[2]
           when 'work-orders' then public.has_permission(case when p_write then 'maintenance.write' else 'maintenance.read' end)
           when 'incidents' then public.has_permission(case when p_write then 'incidents.write' else 'incidents.read' end)
           when 'inspections' then public.has_permission(case when p_write then 'inspections.write' else 'inspections.read' end)
           when 'expenses' then public.has_permission(case when p_write then 'costs.write' else 'costs.read' end)
           when 'fuel' then case
             when p_write then public.has_permission('costs.write')
                            or (public.is_driver_role() and public.my_driver_id() is not null)
             else public.has_permission('costs.read') or public.has_permission('costs.write')
           end
           when 'safety' then public.has_permission(case when p_write then 'safety.write' else 'safety.read' end)
           when 'procedures' then case when p_write then public.has_permission('safety.write') else true end
           -- Drivers upload proof of delivery for their own jobs with dispatch.read.
           when 'dispatch' then case
             when p_write then public.has_permission('dispatch.write')
                            or (public.is_driver_role() and public.has_permission('dispatch.read'))
             else public.has_permission('dispatch.read') or public.has_permission('dispatch.write')
           end
           else false
         end;
$$;

-- The driver's fueling, on the vehicle assigned to them at this moment. `p_id` is made in the
-- phone, so a report sent twice from the offline queue is saved once.
create or replace function public.driver_report_fueling(
  p_id uuid,
  p_occurred_at timestamptz,
  p_total numeric,
  p_liters numeric default null,
  p_odometer numeric default null,
  p_station text default null,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_org_id();
  v_driver uuid := public.my_driver_id();
  v_vehicle uuid;
begin
  if v_driver is null then
    raise exception 'not a driver' using errcode = '42501';
  end if;
  select a.vehicle_id into v_vehicle
    from public.vehicle_driver_assignments a
   where a.driver_id = v_driver and a.org_id = v_org
     -- The vehicle held when the fueling happened: a report sent later from the phone's outbox,
     -- after the driver changed vehicles, still goes to the vehicle that was fueled.
     and a.starts_at <= p_occurred_at and (a.ends_at is null or a.ends_at > p_occurred_at)
   order by a.starts_at desc
   limit 1;
  if v_vehicle is null then
    raise exception 'no vehicle assigned' using errcode = 'P0002';
  end if;
  if p_total is null or p_total <= 0 or (p_liters is not null and p_liters <= 0) then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_occurred_at > now() + interval '1 hour' or p_occurred_at < now() - interval '30 days' then
    raise exception 'fueling time out of range' using errcode = '22023';
  end if;
  if p_receipt_path is not null and p_receipt_path not like v_org::text || '/fuel/%' then
    raise exception 'receipt outside the organization' using errcode = '42501';
  end if;
  insert into public.fuel_transactions (
    id, org_id, vehicle_id, driver_id, occurred_at, total, liters, unit_price,
    odometer_reported, station, receipt_path, source, created_by
  ) values (
    p_id, v_org, v_vehicle, v_driver, p_occurred_at, p_total, p_liters,
    case when p_liters > 0 then round(p_total / p_liters, 3) end,
    p_odometer, nullif(trim(p_station), ''), p_receipt_path, 'driver', auth.uid()
  )
  on conflict (id) do nothing;
  return p_id;
end;
$$;

revoke all on function public.driver_report_fueling(uuid, timestamptz, numeric, numeric, numeric, text, text) from public;
grant execute on function public.driver_report_fueling(uuid, timestamptz, numeric, numeric, numeric, text, text) to authenticated;

commit;
