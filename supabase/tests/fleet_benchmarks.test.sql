-- AI-09: comparing with similar fleets: consent first, give to get, only aggregates of at least
-- five other fleets in the same size band, and costs.read to see it.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select case public.current_role_name()
    when 'owner' then p_permission in ('costs.read', 'users.manage')
    when 'manager' then p_permission = 'costs.read'
    else false end
$$;

-- Seven fleets of 2 vehicles each, fuel of 100..700 per vehicle a month (3 months).
do $$
declare
  i integer;
  org uuid;
  v1 uuid;
  v2 uuid;
begin
  for i in 1..7 loop
    org := ('9' || i || '000000-0000-0000-0000-000000000000')::uuid;
    insert into public.organizations (id, name) values (org, 'Fleet ' || i);
    insert into public.profiles (id, org_id, role)
    values (('00000000-0000-0000-0000-0000000009' || i || '1')::uuid, org, 'owner');
    insert into public.vehicles (org_id, traccar_device_id) values (org, 900 + i * 2) returning id into v1;
    insert into public.vehicles (org_id, traccar_device_id) values (org, 901 + i * 2) returning id into v2;
    insert into public.fuel_transactions (org_id, vehicle_id, occurred_at, total)
    values (org, v1, now() - interval '10 days', i * 100 * 2 * 3);
  end loop;
end $$;
insert into public.profiles (id, org_id, role)
values ('00000000-0000-0000-0000-000000000912', '91000000-0000-0000-0000-000000000000', 'driver');

-- Fleet 1 has not opted in: it sees nothing, and cannot without users.manage.
select pg_temp.as_user('00000000-0000-0000-0000-000000000911');
do $$ begin
  assert (select count(*) from public.fleet_benchmarks()) = 0, 'no consent, no comparison';
end $$;

-- The others opt in.
do $$
declare
  i integer;
begin
  for i in 2..7 loop
    perform pg_temp.as_user('00000000-0000-0000-0000-0000000009' || i || '1');
    perform public.set_benchmark_opt_in(true);
  end loop;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-000000000921');
do $$
declare
  row record;
begin
  -- Fleet 2 compares with fleets 3..7 (five others; fleet 1 has not opted in).
  select * into row from public.fleet_benchmarks() where metric = 'fuel_cost_per_vehicle_month';
  assert row.band = '1-10', 'the size band';
  assert round(row.mine) = round(200 * 2 * 3 / 2.0 / (90 / 30.44)), 'its own value';
  assert row.fleets = 5, 'five other fleets';
  assert round(row.median) = round(500 * 2 * 3 / 2.0 / (90 / 30.44)), 'the median of the others';
  assert row.best < row.median, 'the best tenth is below the median';
  assert not exists (select 1 from public.fleet_benchmarks() where metric = 'failed_check_share'),
    'a metric this fleet does not have is not shown';
end $$;

-- With fewer than five others the figures stay hidden.
select pg_temp.as_user('00000000-0000-0000-0000-000000000971');
do $$ begin
  perform public.set_benchmark_opt_in(false);
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-000000000921');
do $$
declare
  row record;
begin
  select * into row from public.fleet_benchmarks() where metric = 'fuel_cost_per_vehicle_month';
  assert row.fleets = 4 and row.median is null and row.best is null, 'four are too few';
  select * into row from public.fleet_benchmarks(1) where metric = 'fuel_cost_per_vehicle_month';
  assert row.median is null, 'and a caller cannot lower the minimum';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-000000000912');
do $$ begin
  begin
    perform * from public.fleet_benchmarks();
    assert false, 'costs.read is needed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_benchmark_opt_in(true);
    assert false, 'only an admin decides on consent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.benchmark_metrics();
    assert false, 'the per-fleet values are never readable';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
\echo 'fleet_benchmarks.test.sql: all assertions passed'
