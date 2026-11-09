-- The public API (INT-01): keys, scopes, the rate limit per organization, and that a page never
-- leaves the key's organization or shows hidden columns.
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

create or replace function pg_temp.key_hash(p_key text) returns text language sql as $$
  select encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
$$;

insert into public.organizations (id, name) values
  ('a2000000-0000-0000-0000-000000000000', 'API A'),
  ('b2000000-0000-0000-0000-000000000000', 'API B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000002a1', 'a2000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000002b1', 'b2000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000002c1', 'b2000000-0000-0000-0000-000000000000', 'admin');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000002c1');

insert into public.vehicles (id, org_id, traccar_device_id, plate_number, updated_at) values
  ('e2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000000', 601, '11-111-11', '2026-11-01'),
  ('e2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000000', 602, '22-222-22', '2026-11-05'),
  ('e2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000000', 603, '33-333-33', '2026-11-08'),
  ('e2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000000', 604, '44-444-44', '2026-11-08');
insert into public.drivers (org_id, full_name, national_id) values
  ('a2000000-0000-0000-0000-000000000000', 'Dana', '123456782');

-- Keys: a read key and a revoked one for A, a read key for B.
insert into public.api_keys (org_id, name, prefix, key_hash, scopes, revoked_at) values
  ('a2000000-0000-0000-0000-000000000000', 'BI', 'vf_aaaaa',
   pg_temp.key_hash('vf_' || repeat('a', 40)), array['read'], null),
  ('a2000000-0000-0000-0000-000000000000', 'Old', 'vf_bbbbb',
   pg_temp.key_hash('vf_' || repeat('b', 40)), array['read'], now()),
  ('b2000000-0000-0000-0000-000000000000', 'B', 'vf_ccccc',
   pg_temp.key_hash('vf_' || repeat('c', 40)), array['read'], null);

-- Only the service role may call the gateway functions.
select pg_temp.as_user('00000000-0000-0000-0000-0000000002a1');
do $$ begin
  begin
    perform public.api_authorize('vf_' || repeat('a', 40));
    assert false, 'a signed-in user cannot authorize keys';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.api_v1_rows('a2000000-0000-0000-0000-000000000000', 'vehicles');
    assert false, 'a signed-in user cannot read pages for any organization';
  exception when insufficient_privilege then null;
  end;
end $$;

-- An owner cannot raise the package limit; a platform administrator can.
do $$ begin
  begin
    insert into public.api_limits (org_id, per_minute) values ('a2000000-0000-0000-0000-000000000000', 5000);
    assert false, 'an owner cannot set the package limit';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000002c1');
insert into public.api_limits (org_id, per_minute, per_day) values ('a2000000-0000-0000-0000-000000000000', 3, 100);
select pg_temp.as_admin();

do $$
declare
  v jsonb;
begin
  assert (public.api_authorize('nonsense')->>'status') = '401', 'malformed key';
  assert (public.api_authorize('vf_' || repeat('d', 40))->>'status') = '401', 'unknown key';
  assert (public.api_authorize('vf_' || repeat('b', 40))->>'status') = '401', 'revoked key';
  assert (public.api_authorize('vf_' || repeat('a', 40), 'write')->>'status') = '403', 'read key cannot write';

  v := public.api_authorize('vf_' || repeat('a', 40));
  assert v->>'status' = '200', 'valid key';
  assert v->>'org_id' = 'a2000000-0000-0000-0000-000000000000', 'the key''s organization';
  assert (v->>'limit')::int = 3 and (v->>'remaining')::int = 2, 'the package limit and what is left';
  perform public.api_authorize('vf_' || repeat('a', 40));
  perform public.api_authorize('vf_' || repeat('a', 40));
  v := public.api_authorize('vf_' || repeat('a', 40));
  assert v->>'status' = '429', 'over the limit';
  assert (v->>'retry_after')::int between 1 and 60, 'retry within the minute';
  assert (public.api_authorize('vf_' || repeat('c', 40))->>'status') = '200',
    'another organization has its own count';
  assert (select last_used_at is not null from public.api_keys where name = 'BI'), 'last use noted';
end $$;

-- Pages stay in the organization, leave hidden columns out and follow "changed since".
do $$
declare
  v jsonb;
  r text;
begin
  v := public.api_v1_rows('a2000000-0000-0000-0000-000000000000', 'vehicles');
  assert (v->>'count')::int = 3, 'only organization A''s vehicles';
  assert not (v->'data'->0 ? 'org_id'), 'org_id left out';
  assert v->'data'->0->>'plate_number' = '11-111-11', 'oldest change first';
  assert v->'data'->0 ? 'changed_at', 'every row says when it changed';

  v := public.api_v1_rows('a2000000-0000-0000-0000-000000000000', 'vehicles', '2026-11-05', 100, 0);
  assert (v->>'count')::int = 2, 'changed since';

  v := public.api_v1_rows('a2000000-0000-0000-0000-000000000000', 'vehicles', null, 2, 2);
  assert (v->>'count')::int = 1 and v->'data'->0->>'plate_number' = '33-333-33', 'the second page';

  v := public.api_v1_rows('a2000000-0000-0000-0000-000000000000', 'drivers');
  assert v->'data'->0->>'full_name' = 'Dana' and not (v->'data'->0 ? 'national_id'),
    'national ID never leaves';

  assert public.api_v1_rows('a2000000-0000-0000-0000-000000000000', 'profiles') is null,
    'only listed resources';

  foreach r in array array['vehicles', 'drivers', 'assignments', 'documents', 'work_orders', 'issues',
    'inspections', 'incidents', 'fuel', 'expenses', 'monthly_costs', 'violations', 'dispatch_jobs'] loop
    v := public.api_v1_rows('b2000000-0000-0000-0000-000000000000', r);
    assert v is not null, format('resource %s answers', r);
  end loop;
  assert (public.api_v1_rows('b2000000-0000-0000-0000-000000000000', 'vehicles')->>'count')::int = 1,
    'organization B sees its own';
end $$;

-- An integration manager sees the organization's usage; another organization does not.
select pg_temp.as_user('00000000-0000-0000-0000-0000000002a1');
do $$ begin
  assert (select sum(count) from public.api_usage) = 4, 'own usage';
  assert (select count(*) from public.api_limits) = 1, 'own limits';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000002b1');
do $$ begin
  assert (select coalesce(sum(count), 0) from public.api_usage) = 1, 'not the other organization''s usage';
end $$;

rollback;
