-- "Log in as" (SEC-13): the start needs a reason and is recorded with who did it; rows written
-- while impersonating carry the impersonator from the token.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('aa000000-0000-0000-0000-000000000000', 'Imp A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-00000000aaa1', 'aa000000-0000-0000-0000-000000000000', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-00000000aaa1');
do $$ begin
  begin
    perform public.record_impersonation('start', 7, 'דנה', 'תמיכה', '');
    assert false, 'a reason is needed';
  exception when invalid_parameter_value then null;
  end;
  perform public.record_impersonation('start', 7, 'דנה', 'תמיכה', 'בדיקת תקלה בדוח');
end $$;

reset role;
do $$ begin
  assert (select new_data ->> 'reason' from public.audit_log where action = 'impersonate_start'
           and row_id = '7') = 'בדיקת תקלה בדוח', 'recorded with the reason';
end $$;

-- A row written under a token that says who impersonates.
select set_config('request.jwt.claims', '{"impersonated_by": "admin@demo.invalid"}', true);
insert into public.audit_log (org_id, action, table_name) values
  ('aa000000-0000-0000-0000-000000000000', 'update', 'vehicles');
do $$ begin
  assert (select impersonated_by from public.audit_log where table_name = 'vehicles'
           and org_id = 'aa000000-0000-0000-0000-000000000000') = 'admin@demo.invalid',
    'the impersonator is on the row';
end $$;

rollback;
\echo 'impersonation.test.sql: all assertions passed'
