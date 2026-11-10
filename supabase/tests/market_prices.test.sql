-- AI-08: market prices across fleets: consent, at least five other fleets, only medians.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select case public.current_role_name() when 'owner' then p_permission = 'maintenance.read' else false end
$$;

-- Seven fleets did an oil change at 150..450, all opted in but the last.
do $$
declare
  i integer;
  org uuid;
  v uuid;
  w uuid;
begin
  for i in 1..7 loop
    org := ('4' || i || '000000-0000-0000-0000-000000000000')::uuid;
    insert into public.organizations (id, name, benchmark_opt_in) values (org, 'Fleet ' || i, i < 7);
    insert into public.profiles (id, org_id, role)
    values (('00000000-0000-0000-0000-0000000004' || i || '1')::uuid, org, 'owner');
    insert into public.vehicles (org_id, traccar_device_id) values (org, 400 + i) returning id into v;
    insert into public.work_orders (org_id, vehicle_id, title, status, opened_at, closed_at)
    values (org, v, 'טיפול', 'done', now() - interval '20 days', now() - interval '19 days') returning id into w;
    insert into public.work_order_items (org_id, work_order_id, kind, description, quantity, unit_price)
    values (org, w, 'labor', case when i % 2 = 0 then 'החלפת שמן' else 'החלפת-שמן!' end, 1, 100 + i * 50);
  end loop;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-000000000411');
do $$
declare
  row record;
begin
  select * into row from public.market_prices(array['החלפת שמן', 'שטיפה']);
  assert row.description = 'החלפת שמן', 'found loosely, by the asked description';
  assert row.fleets = 5, 'five other opted-in fleets (not itself, not the one that said no)';
  assert row.median = 300, 'the median of 200..400';
  assert (select count(*) from public.market_prices(array['שטיפה'])) = 0, 'unknown lines give nothing';
  assert (select count(*) from public.market_prices(array['החלפת שמן'], 1)) = 1, 'the minimum stays 5';
end $$;

-- With fewer than five others, nothing.
select pg_temp.as_user('00000000-0000-0000-0000-000000000461');
do $$ begin
  update public.organizations set benchmark_opt_in = false where id = public.current_org_id();
end $$;
reset role;
update public.organizations set benchmark_opt_in = false where id = '46000000-0000-0000-0000-000000000000';
select pg_temp.as_user('00000000-0000-0000-0000-000000000411');
do $$ begin
  assert (select count(*) from public.market_prices(array['החלפת שמן'])) = 0, 'four are too few';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-000000000471');
do $$ begin
  assert (select count(*) from public.market_prices(array['החלפת שמן'])) = 0, 'no consent, no comparison';
end $$;

rollback;
\echo 'market_prices.test.sql: all assertions passed'
