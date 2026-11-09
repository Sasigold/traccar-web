-- AI (AI-01..04): only members of an organization with the AI on, within the daily limit, can
-- start a call; usage is counted; the key and the token counter are for the service role only;
-- the fault-code library is readable by every signed-in user and written by nobody else.
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
  ('a4000000-0000-0000-0000-000000000000', 'AI A'),
  ('b4000000-0000-0000-0000-000000000000', 'AI B');
insert into public.profiles (id, org_id, role, is_active) values
  ('00000000-0000-0000-0000-0000000004a1', 'a4000000-0000-0000-0000-000000000000', 'owner', true),
  ('00000000-0000-0000-0000-0000000004a2', 'a4000000-0000-0000-0000-000000000000', 'viewer', false),
  ('00000000-0000-0000-0000-0000000004b1', 'b4000000-0000-0000-0000-000000000000', 'owner', true);

-- A member of an organization starts a call, and it is counted.
select pg_temp.as_user('00000000-0000-0000-0000-0000000004a1');
do $$ begin
  assert public.ai_begin('ask') = 'a4000000-0000-0000-0000-000000000000', 'the organization';
  perform public.ai_begin('dtc');
  assert (public.ai_status() ->> 'used_today')::int = 2, 'two calls today';
  assert (public.ai_status() ->> 'enabled')::boolean, 'on by default';
end $$;

-- An unknown kind, a user who left and nobody at all are refused.
do $$ begin
  begin
    perform public.ai_begin('anything');
    assert false, 'an unknown kind is refused';
  exception when invalid_parameter_value then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000004a2');
do $$ begin
  begin
    perform public.ai_begin('ask');
    assert false, 'an inactive user is refused';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Switched off, or over the limit: refused.
select pg_temp.as_admin();
insert into public.ai_settings (org_id, enabled, daily_limit)
values ('b4000000-0000-0000-0000-000000000000', false, 5),
       ('a4000000-0000-0000-0000-000000000000', true, 3);
select pg_temp.as_user('00000000-0000-0000-0000-0000000004b1');
do $$ begin
  begin
    perform public.ai_begin('ask');
    assert false, 'switched off';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000004a1');
do $$ begin
  perform public.ai_begin('extract');
  begin
    perform public.ai_begin('ask');
    assert false, 'the fourth call is over the limit of three';
  exception when sqlstate '53400' then null;
  end;
end $$;

-- Users cannot read the counter, write tokens, read the key or change another organization.
do $$ begin
  begin
    perform count(*) from public.ai_usage;
    assert false, 'usage is not readable directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ai_record_tokens('a4000000-0000-0000-0000-000000000000', 'ask', 1, 1);
    assert false, 'tokens are recorded by the service role only';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ai_secret();
    assert false, 'the key is for the service role only';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ai_set_secret('sk-test');
    assert false, 'only platform administrators set the key';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.ai_settings) = 1, 'only its own settings are visible';
  update public.ai_settings set enabled = false where org_id = 'b4000000-0000-0000-0000-000000000000';
end $$;

-- The fault-code library: everyone reads it, nobody writes it.
do $$ begin
  assert (select severity from public.dtc_library where code = 'P0217') = 'critical', 'seeded';
  begin
    insert into public.dtc_library (code, title_he, severity, drive_today) values ('P0001', 'x', 'low', 'yes');
    assert false, 'users do not write the library';
  exception when insufficient_privilege then null;
  end;
  assert 'ai' = any(public.fleet_features()), 'the feature is listed';
end $$;

select pg_temp.as_admin();
do $$ begin
  assert (select enabled from public.ai_settings
           where org_id = 'b4000000-0000-0000-0000-000000000000') = false,
    'another organization''s settings were not changed';
  perform public.ai_record_tokens('a4000000-0000-0000-0000-000000000000', 'ask', 120, 30);
  assert (select input_tokens from public.ai_usage
           where org_id = 'a4000000-0000-0000-0000-000000000000' and kind = 'ask') = 120,
    'tokens recorded';
end $$;

rollback;
\echo 'fleet_ai.test.sql: all assertions passed'
