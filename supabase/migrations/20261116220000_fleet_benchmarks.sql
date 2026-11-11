-- viper fleet: comparing a fleet with similar fleets (AI-09). Idempotent.
--
-- "Is 900 ₪ of fuel per vehicle a month a lot?" For each metric: this fleet, the median of
-- similar fleets and the best tenth. Fair and private:
-- 1. Consent: an organization takes part only after opting in (benchmark_opt_in, set by an admin
--    with users.manage; the contract says so). Give to get: only taking part shows the others.
-- 2. Similar: the same size band by vehicle count (1-10, 11-50, 51-200, 201+).
-- 3. Anonymous: only aggregates leave the function, and only when at least 5 other fleets in the
--    band have the metric; no organization is ever named or shown on its own.
-- Metrics, over the last 90 days, all "lower is better": fuel and maintenance cost per vehicle a
-- month, incidents per 100 vehicles a year, the share of failed morning checks, and violations
-- per 10 drivers a year.

begin;

alter table public.organizations add column if not exists benchmark_opt_in boolean not null default false;

create or replace function public.set_benchmark_opt_in(p_opt_in boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_permission('users.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.organizations set benchmark_opt_in = coalesce(p_opt_in, false)
   where id = public.current_org_id();
end;
$$;

revoke all on function public.set_benchmark_opt_in(boolean) from public, anon;
grant execute on function public.set_benchmark_opt_in(boolean) to authenticated;

-- One row per organization and metric (internal: never granted to users).
create or replace function public.benchmark_metrics(p_since timestamptz default now() - interval '90 days')
returns table (org_id uuid, band text, metric text, value numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  with fleets as (
    select o.id as org_id,
           (select count(*) from public.vehicles v where v.org_id = o.id) as vehicles,
           (select count(*) from public.drivers d where d.org_id = o.id) as drivers
      from public.organizations o
  ),
  sized as (
    select f.*, case when vehicles <= 10 then '1-10' when vehicles <= 50 then '11-50'
                     when vehicles <= 200 then '51-200' else '201+' end as band
      from fleets f where vehicles > 0
  ),
  months as (select greatest(extract(epoch from now() - p_since) / (30.44 * 86400), 1) as n),
  values_ as (
    select s.org_id, s.band, 'fuel_cost_per_vehicle_month' as metric,
           (select sum(total) from public.fuel_transactions t
             where t.org_id = s.org_id and t.occurred_at >= p_since) / s.vehicles / (select n from months) as value
      from sized s
    union all
    select s.org_id, s.band, 'maintenance_cost_per_vehicle_month',
           (select sum(total_cost) from public.work_orders w
             where w.org_id = s.org_id and w.status = 'done'
               and coalesce(w.closed_at, w.opened_at) >= p_since) / s.vehicles / (select n from months)
      from sized s
    union all
    select s.org_id, s.band, 'incidents_per_100_vehicles_year',
           (select count(*) from public.incidents i where i.org_id = s.org_id and i.occurred_at >= p_since)
             * 100.0 / s.vehicles * 12 / (select n from months)
      from sized s
    union all
    select s.org_id, s.band, 'failed_check_share',
           (select case when count(*) >= 10 then count(*) filter (where result = 'fail')::numeric / count(*) end
              from public.inspections c where c.org_id = s.org_id and c.started_at >= p_since)
      from sized s
    union all
    select s.org_id, s.band, 'violations_per_10_drivers_year',
           case when s.drivers > 0 then
             (select count(*) from public.driver_violations x where x.org_id = s.org_id and x.occurred_at >= p_since)
               * 10.0 / s.drivers * 12 / (select n from months) end
      from sized s
  )
  select org_id, band, metric, value from values_ where value is not null
$$;

revoke all on function public.benchmark_metrics(timestamptz) from public, anon, authenticated;

-- What the caller's fleet sees: its own value, and the median and best tenth of the others in its
-- band when at least p_min_fleets of them have the metric. Needs costs.read and consent.
create or replace function public.fleet_benchmarks(p_min_fleets integer default 5)
returns table (metric text, band text, mine numeric, median numeric, best numeric, fleets integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  me uuid := public.current_org_id();
begin
  if not public.has_permission('costs.read') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not coalesce((select benchmark_opt_in from public.organizations where id = me), false) then
    return;
  end if;
  return query
    with all_values as (select * from public.benchmark_metrics()),
    own as (select a.metric, a.band, a.value from all_values a where a.org_id = me),
    peers as (
      select a.metric, a.value
        from all_values a
        join public.organizations o on o.id = a.org_id and o.benchmark_opt_in
        join own on own.metric = a.metric and own.band = a.band
       where a.org_id <> me
    ),
    stats as (
      select p.metric, count(*)::integer as n,
             percentile_cont(0.5) within group (order by p.value) as median,
             percentile_cont(0.1) within group (order by p.value) as best
        from peers p group by p.metric
    )
    select own.metric, own.band, round(own.value, 4),
           case when s.n >= greatest(p_min_fleets, 5) then round(s.median::numeric, 4) end,
           case when s.n >= greatest(p_min_fleets, 5) then round(s.best::numeric, 4) end,
           coalesce(s.n, 0)
      from own left join stats s on s.metric = own.metric
     order by own.metric;
end;
$$;

revoke all on function public.fleet_benchmarks(integer) from public, anon;
grant execute on function public.fleet_benchmarks(integer) to authenticated;

commit;
