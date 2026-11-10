-- viper fleet: what the browser measures (FND-06). Idempotent.
--
-- The UI sends a batch every few minutes and when the page is hidden (src/common/telemetry):
-- web vitals (LCP, INP, CLS, FCP, TTFB), long tasks, and operational counters such as socket
-- disconnects, fleet-token failures, chunk-load errors and Supabase error codes.
--
--   client_metrics        one row per measurement, with the release, the environment, the screen
--                         as a template ("/settings/device/:id") and the organization; never the
--                         user. Kept 30 days.
--   client_metrics_usage  rows accepted per user and hour, so no one can fill the table
--   record_client_metrics(release, environment, batch)   the only way in; checks every value
--   client_metrics_overview(days)                         per release and metric: p75, share
--                                                         rated good, totals; platform admins only

begin;

create table if not exists public.client_metrics (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  org_id uuid references public.organizations (id) on delete cascade,
  release text not null,
  environment text not null,
  kind text not null check (kind in ('vital', 'counter', 'longtask')),
  name text not null,
  route text,
  value double precision not null,
  rating text check (rating in ('good', 'needs-improvement', 'poor'))
);

comment on table public.client_metrics is
  'Browser measurements (FND-06): web vitals, long tasks and counters. Nothing personal; 30 days.';

create index if not exists client_metrics_time_idx on public.client_metrics (recorded_at desc);

create table if not exists public.client_metrics_usage (
  user_id uuid not null,
  hour timestamptz not null,
  count integer not null default 0,
  primary key (user_id, hour)
);

alter table public.client_metrics enable row level security;
alter table public.client_metrics_usage enable row level security;

-- Read through client_metrics_overview only; written through record_client_metrics only.
revoke all on public.client_metrics from anon, authenticated;
revoke all on public.client_metrics_usage from anon, authenticated;

-- A JSON number as a double, null for anything else.
create or replace function public.client_metric_number(p_value jsonb)
returns double precision
language sql
immutable
as $$
  select case when jsonb_typeof(p_value) = 'number' then (p_value)::double precision end
$$;

-- Returns the number of rows kept. Values outside the rules are skipped, not an error: an old tab
-- must never get stuck on a batch.
create or replace function public.record_client_metrics(
  p_release text,
  p_environment text,
  p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.current_org_id();
  v_hour timestamptz := date_trunc('hour', now());
  v_used integer;
  v_room integer;
  v_rows integer := 0;
  v_counters jsonb;
  v_vitals jsonb;
  v_long jsonb;
begin
  if v_user is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_release is null or p_release !~ '^[0-9A-Za-z.+_-]{1,40}$'
     or p_environment is null or p_environment not in ('production', 'staging', 'development', 'demo')
     or jsonb_typeof(p_metrics) is distinct from 'object' then
    raise exception 'not a metrics batch' using errcode = '22023';
  end if;

  select coalesce(sum(count), 0) into v_used
    from public.client_metrics_usage where user_id = v_user and hour = v_hour;
  -- 500 rows an hour per user: a busy session sends a few dozen.
  v_room := 500 - v_used;
  if v_room <= 0 then
    return 0;
  end if;

  v_counters := case when jsonb_typeof(p_metrics->'counters') = 'object'
                     then p_metrics->'counters' else '{}'::jsonb end;
  -- Only objects: value->'value' on anything else is null and the row is skipped.
  v_vitals := case when jsonb_typeof(p_metrics->'vitals') = 'array'
                   then p_metrics->'vitals' else '[]'::jsonb end;
  v_long := case when jsonb_typeof(p_metrics->'longtasks') = 'object'
                 then p_metrics->'longtasks' else '{}'::jsonb end;

  -- Every number goes through public.client_metric_number, which is null for anything else, so a
  -- string where a number belongs is skipped instead of failing the cast.
  insert into public.client_metrics (org_id, release, environment, kind, name, route, value, rating)
  select v_org, p_release, p_environment, b.kind, b.name, b.route, b.value, b.rating
    from (
      select 'counter'::text as kind, c.key as name, null::text as route, c.num as value,
             null::text as rating
        from (select key, public.client_metric_number(value) as num
                from jsonb_each(v_counters) limit 50) c
       where c.key ~ '^[a-z][a-z0-9_.]{0,59}$' and c.num between 1 and 100000
      union all
      select 'vital', s.v->>'name', s.v->>'route', s.num, s.v->>'rating'
        from (select value as v, public.client_metric_number(value->'value') as num
                from jsonb_array_elements(v_vitals) limit 100) s
       where s.v->>'name' in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')
         and s.num between 0 and 600000
         and (s.v->>'route' is null or s.v->>'route' ~ '^/[A-Za-z0-9/_:.-]{0,119}$')
         and (s.v->>'rating' is null or s.v->>'rating' in ('good', 'needs-improvement', 'poor'))
      union all
      select 'longtask', l.name, null, public.client_metric_number(v_long->l.name), null
        from (values ('count', 1, 100000), ('total_ms', 0, 86400000), ('max_ms', 0, 86400000))
             as l (name, low, high)
       where public.client_metric_number(v_long->'count') >= 1
         and public.client_metric_number(v_long->l.name) between l.low and l.high
      limit v_room
    ) b;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into public.client_metrics_usage as u (user_id, hour, count)
    values (v_user, v_hour, v_rows)
    on conflict (user_id, hour) do update set count = u.count + excluded.count;
  end if;
  return v_rows;
end;
$$;

-- Per release and metric over the last p_days days (1 to 90). Vitals: p75 and the share rated
-- "good"; counters and long tasks: the total and the largest single value; and how many
-- organizations reported it.
create or replace function public.client_metrics_overview(p_days integer default 7)
returns table (
  release text,
  kind text,
  name text,
  samples bigint,
  total double precision,
  p75 double precision,
  good double precision,
  maximum double precision,
  orgs bigint,
  last_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform administrators only' using errcode = '42501';
  end if;
  return query
    select m.release, m.kind, m.name,
           count(*),
           sum(m.value),
           case when m.kind = 'vital'
                then percentile_cont(0.75) within group (order by m.value) end,
           case when m.kind = 'vital'
                then avg(case when m.rating = 'good' then 1.0 else 0.0 end)::double precision end,
           max(m.value),
           count(distinct m.org_id),
           max(m.recorded_at)
      from public.client_metrics m
     where m.recorded_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
     group by m.release, m.kind, m.name
     order by max(m.recorded_at) desc, m.kind, m.name;
end;
$$;

create or replace function public.client_metrics_cleanup()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.client_metrics where recorded_at < now() - interval '30 days';
  delete from public.client_metrics_usage where hour < now() - interval '1 day';
$$;

revoke all on function public.record_client_metrics(text, text, jsonb) from public, anon;
revoke all on function public.client_metrics_overview(integer) from public, anon;
revoke all on function public.client_metrics_cleanup() from public, anon, authenticated;
grant execute on function public.record_client_metrics(text, text, jsonb) to authenticated;
grant execute on function public.client_metrics_overview(integer) to authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'vf_client_metrics_cleanup';
  perform cron.schedule('vf_client_metrics_cleanup', '40 3 * * *', 'select public.client_metrics_cleanup();');
end $$;

commit;
