-- Browser measurements (FND-06): only signed-in users write, only through the function, only
-- valid values, within the hourly quota; only platform administrators read the overview.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

insert into public.organizations (id, name) values
  ('a3000000-0000-0000-0000-000000000000', 'Metrics A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000003a1', 'a3000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000003a2', 'a3000000-0000-0000-0000-000000000000', 'admin'),
  ('00000000-0000-0000-0000-0000000003a3', 'a3000000-0000-0000-0000-000000000000', 'viewer');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000003a2');

-- Without a signed-in user there is nothing to record.
select pg_temp.as_user('');
do $$ begin
  begin
    perform public.record_client_metrics('1.0.0+abc1234', 'production', '{}'::jsonb);
    assert false, 'an anonymous call is refused';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A signed-in user cannot read or write the table directly.
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
do $$ begin
  begin
    perform count(*) from public.client_metrics;
    assert false, 'the table is not readable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.client_metrics (release, environment, kind, name, value)
    values ('x', 'production', 'counter', 'x', 1);
    assert false, 'the table is not writable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.client_metrics_overview(7);
    assert false, 'only platform administrators read the overview';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.client_metrics_cleanup();
    assert false, 'only the schedule cleans up';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Malformed batches are refused; invalid values inside a batch are skipped.
do $$ begin
  begin
    perform public.record_client_metrics('1.0.0; drop table x', 'production', '{}'::jsonb);
    assert false, 'a bad release is refused';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_client_metrics('1.0.0+abc1234', 'mars', '{}'::jsonb);
    assert false, 'an unknown environment is refused';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_client_metrics('1.0.0+abc1234', 'production', '[]'::jsonb);
    assert false, 'a batch is an object';
  exception when invalid_parameter_value then null;
  end;
end $$;

do $$
declare
  v integer;
begin
  v := public.record_client_metrics('1.0.0+abc1234', 'production', $json${
    "counters": {"socket_disconnect": 3, "fleet_error.42501": 1, "Bad Name": 2, "zero": 0,
                 "text": "5", "huge": 1e9},
    "vitals": [
      {"name": "LCP", "value": 1800, "rating": "good", "route": "/"},
      {"name": "LCP", "value": 4200, "rating": "poor", "route": "/settings/device/:id"},
      {"name": "INP", "value": 150, "rating": "good", "route": "/"},
      {"name": "FID", "value": 10, "rating": "good", "route": "/"},
      {"name": "CLS", "value": "0.1", "rating": "good", "route": "/"},
      {"name": "TTFB", "value": 300, "rating": "great", "route": "/"},
      {"name": "FCP", "value": 900, "rating": "good", "route": "/<script>"},
      "not an object"
    ],
    "longtasks": {"count": 4, "total_ms": 420, "max_ms": 180}
  }$json$::jsonb);
  assert v = 8, format('2 counters, 3 vitals and 3 long-task rows are kept, not %s', v);
end $$;

-- A batch with nothing valid records nothing.
do $$ begin
  assert public.record_client_metrics('1.0.0+abc1234', 'production',
    '{"counters": {"x": -1}, "longtasks": {"count": 0, "total_ms": 0, "max_ms": 0}}'::jsonb) = 0,
    'nothing to keep';
end $$;

-- The rows belong to the user's organization and never name the user.
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.client_metrics
           where org_id = 'a3000000-0000-0000-0000-000000000000') = 8, 'rows carry the organization';
  assert not exists (select 1 from information_schema.columns
                      where table_name = 'client_metrics' and column_name like '%user%'),
    'no user column';
  assert (select count from public.client_metrics_usage
           where user_id = '00000000-0000-0000-0000-0000000003a1') = 8, 'usage is counted';
end $$;

-- The hourly quota: 500 rows per user, the rest is dropped quietly.
update public.client_metrics_usage set count = 498
 where user_id = '00000000-0000-0000-0000-0000000003a1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
do $$ begin
  assert public.record_client_metrics('1.0.0+abc1234', 'production',
    '{"counters": {"a": 1, "b": 1, "c": 1}}'::jsonb) = 2, 'only the room left is used';
  assert public.record_client_metrics('1.0.0+abc1234', 'production',
    '{"counters": {"d": 1}}'::jsonb) = 0, 'over the quota nothing is kept';
end $$;

-- Another user of the same organization has their own quota.
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a3');
do $$ begin
  assert public.record_client_metrics('1.0.0+def5678', 'staging',
    '{"vitals": [{"name": "LCP", "value": 2000, "rating": "needs-improvement", "route": "/"}]}'::jsonb) = 1,
    'a viewer records too';
end $$;

-- The platform administrator's overview: p75, share rated good, totals.
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a2');
do $$
declare
  r record;
begin
  select * into r from public.client_metrics_overview(7)
   where release = '1.0.0+abc1234' and kind = 'vital' and name = 'LCP';
  assert r.samples = 2, 'two LCP samples';
  assert r.p75 = 3600, format('p75 of 1800 and 4200 is 3600, not %s', r.p75);
  assert r.good = 0.5, 'half rated good';
  assert r.orgs = 1, 'one organization';
  select * into r from public.client_metrics_overview(7)
   where release = '1.0.0+abc1234' and kind = 'counter' and name = 'socket_disconnect';
  assert r.total = 3 and r.p75 is null, 'counters are summed';
  select * into r from public.client_metrics_overview(7)
   where release = '1.0.0+abc1234' and kind = 'longtask' and name = 'max_ms';
  assert r.maximum = 180, 'the longest task';
  assert (select count(*) from public.client_metrics_overview(7) where release = '1.0.0+def5678') = 1,
    'releases are separate';
end $$;

-- The cleanup keeps 30 days.
select pg_temp.as_admin();
update public.client_metrics set recorded_at = now() - interval '31 days' where name = 'INP';
select public.client_metrics_cleanup();
do $$ begin
  assert not exists (select 1 from public.client_metrics where name = 'INP'), 'old rows are removed';
  assert exists (select 1 from public.client_metrics where name = 'LCP'), 'recent rows stay';
  assert exists (select 1 from cron.job where jobname = 'vf_client_metrics_cleanup'), 'scheduled';
end $$;

rollback;
\echo 'client_metrics.test.sql: all assertions passed'
