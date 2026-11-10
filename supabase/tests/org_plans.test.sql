-- BIZ-02: an organization reads its own plan; only a platform admin changes it.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('a8000000-0000-0000-0000-000000000000', 'Plans A'),
  ('b8000000-0000-0000-0000-000000000000', 'Plans B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000008a1', 'a8000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000008b1', 'b8000000-0000-0000-0000-000000000000', 'owner');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000008b1');

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a1');
do $$ begin
  assert (public.org_plan()->>'plan') = 'pro', 'existing organizations start on pro';
  begin
    perform public.set_org_plan('a8000000-0000-0000-0000-000000000000', 'pro');
    assert false, 'an owner cannot change the plan';
  exception when insufficient_privilege then null;
  end;
  -- Even with update rights on the organization, the plan columns are guarded.
  begin
    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000008a1', true);
    grant update on public.organizations to authenticated;
    execute 'set local role authenticated';
    update public.organizations set plan = 'pro', plan_trial_until = now() + interval '1 year'
     where id = 'a8000000-0000-0000-0000-000000000000';
    assert false, 'an owner cannot upgrade the plan directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The platform admin moves A to tracking with a fleet trial for a week.
select pg_temp.as_user('00000000-0000-0000-0000-0000000008b1');
select public.set_org_plan('a8000000-0000-0000-0000-000000000000', 'tracking', 'fleet',
                           now() + interval '7 days');

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a1');
do $$
declare r jsonb := public.org_plan();
begin
  assert r->>'plan' = 'tracking', 'the plan';
  assert r->>'trial' = 'fleet', 'the trial while it lasts';
end $$;

rollback;
\echo 'org_plans.test.sql: all assertions passed'
