-- viper fleet: the order of a vehicle's stops (OPS-03). Idempotent.
--
-- route_order: the stop's place in its vehicle's planned route (1, 2, ...), set when the
-- dispatcher applies a planned route; the driver's job list follows it. Null: not planned.

begin;

alter table public.dispatch_jobs
  add column if not exists route_order integer check (route_order is null or route_order > 0);

create index if not exists dispatch_jobs_route_idx
  on public.dispatch_jobs (vehicle_id, route_order) where route_order is not null;

commit;
