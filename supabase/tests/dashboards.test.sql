-- ARC-09: a person reads and writes only their own dashboards; every member reads the
-- organization default, and only users.manage publishes it; nothing crosses organizations.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

-- The stand-in has_permission() says no to everything; here the owner manages users.
create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select p_permission = 'users.manage' and public.current_role_name() = 'owner'
$$;

insert into public.organizations (id, name) values
  ('da000000-0000-0000-0000-000000000000', 'Dash A'),
  ('db000000-0000-0000-0000-000000000000', 'Dash B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000da001', 'da000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000da002', 'da000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000db001', 'db000000-0000-0000-0000-000000000000', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-0000000da001');
insert into public.dashboards (org_id, doc)
values ('da000000-0000-0000-0000-000000000000', '{"v": 1, "d": []}')
on conflict (profile_id) do update set doc = excluded.doc;
insert into public.dashboards (org_id, doc)
values ('da000000-0000-0000-0000-000000000000', '{"v": 1, "d": [], "a": "x"}')
on conflict (profile_id) do update set doc = excluded.doc;
insert into public.dashboard_defaults (org_id, doc)
values ('da000000-0000-0000-0000-000000000000', '{"v": 1, "d": []}');
do $$ begin
  assert (select count(*) from public.dashboards) = 1, 'one row per person';
  assert (select doc->>'a' from public.dashboards) = 'x', 'the upsert replaced the document';
  assert (select profile_id from public.dashboards) = '00000000-0000-0000-0000-0000000da001',
    'the row belongs to whoever saved it';
  assert (select count(*) from public.audit_log where table_name = 'dashboard_defaults') = 1,
    'publishing a default is audited';
  begin
    insert into public.dashboards (org_id, profile_id, doc)
    values ('da000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000da002', '{}');
    assert false, 'nobody writes the dashboards of another person';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.dashboards (org_id, doc) values ('da000000-0000-0000-0000-000000000000', '[]');
    assert false, 'the document is an object';
  exception when check_violation or unique_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000da002');
do $$ begin
  assert (select count(*) from public.dashboards) = 0, 'a member does not see the others';
  assert (select count(*) from public.dashboard_defaults) = 1, 'every member reads the default';
  begin
    update public.dashboard_defaults set doc = '{"v": 1, "d": [], "a": "mine"}';
    assert (select doc->>'a' from public.dashboard_defaults) is null,
      'without users.manage the default does not change';
  end;
  begin
    insert into public.dashboard_defaults (org_id, doc)
    values ('da000000-0000-0000-0000-000000000000', '{}');
    assert false, 'without users.manage nobody publishes';
  exception when insufficient_privilege then null;
  end;
  insert into public.dashboards (org_id, doc) values ('da000000-0000-0000-0000-000000000000', '{"v": 1, "d": []}');
  assert (select count(*) from public.dashboards) = 1, 'a member keeps a dashboard of their own';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000db001');
do $$ begin
  assert (select count(*) from public.dashboards) = 0, 'another organization sees no dashboards';
  assert (select count(*) from public.dashboard_defaults) = 0, 'nor its default';
  begin
    insert into public.dashboards (org_id, doc) values ('da000000-0000-0000-0000-000000000000', '{}');
    assert false, 'nor writes into it';
  exception when insufficient_privilege then null;
  end;
  assert 'dashboards' = any (public.fleet_features()), 'the feature is announced';
end $$;

rollback;
