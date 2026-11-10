-- SEC-22: API keys are made on the server, stored as a peppered HMAC, scoped and expiring;
-- the browser cannot insert its own; old keys keep working.
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

insert into public.organizations (id, name) values ('a7000000-0000-0000-0000-000000000000', 'Keys A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000007a1', 'a7000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000007a2', 'a7000000-0000-0000-0000-000000000000', 'viewer');

-- An old key (plain SHA-256) made before this change.
insert into public.api_keys (org_id, name, prefix, key_hash, scopes) values
  ('a7000000-0000-0000-0000-000000000000', 'old', 'vf_aaaaa',
   encode(sha256(convert_to('vf_' || repeat('a', 40), 'UTF8')), 'hex'), array['read']);

select public.api_key_set_pepper(repeat('p', 40));

create temp table made (result jsonb);
grant all on made to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000007a1');
insert into made select public.create_api_key('ERP', array['read', 'write']);
do $$
declare
  r jsonb := (select result from made);
begin
  assert (r->>'key') ~ '^vf_[0-9a-f]{40}$', 'a vf_ key of 40 hex';
  assert (r->>'expires_at')::timestamptz between now() + interval '364 days' and now() + interval '366 days',
    'expires in a year by default';
  begin
    insert into public.api_keys (org_id, name, prefix, key_hash)
    values ('a7000000-0000-0000-0000-000000000000', 'mine', 'vf_x', 'x');
    assert false, 'the browser cannot insert a key';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_api_key('bad', array['admin']);
    assert false, 'unknown scope';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_api_key('long', array['read'], now() + interval '5 years');
    assert false, 'at most two years';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- A viewer (no integrations.manage) cannot make keys.
select pg_temp.as_user('00000000-0000-0000-0000-0000000007a2');
do $$ begin
  perform public.create_api_key('x');
  assert false, 'needs integrations.manage';
exception when insufficient_privilege then null;
end $$;

select pg_temp.as_admin();
do $$
declare
  r jsonb := (select result from made);
  stored text := (select key_hash from public.api_keys where name = 'ERP');
begin
  assert stored like 'h1:%', 'stored as a peppered HMAC';
  assert stored <> encode(sha256(convert_to(r->>'key', 'UTF8')), 'hex'), 'not a plain hash';
  assert (public.api_authorize(r->>'key', 'write')->>'status') is distinct from '401', 'the new key works';
  assert (public.api_authorize('vf_' || repeat('a', 40), 'read')->>'status') is distinct from '401',
    'the old key still works';
  assert (public.api_authorize('vf_' || repeat('b', 40), 'read')->>'status') = '401', 'a wrong key does not';
  begin
    update public.api_keys set scopes = array['root'] where name = 'ERP';
    assert false, 'scopes are checked';
  exception when check_violation then null;
  end;
end $$;

rollback;
\echo 'api_keys_server.test.sql: all assertions passed'
