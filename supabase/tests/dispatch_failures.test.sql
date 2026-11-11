-- ADM-20: a driver marking a job as failed says why, from the list only.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a9000000-0000-0000-0000-000000000000', 'Fail A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000009a1', 'a9000000-0000-0000-0000-000000000000', 'driver');
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000009a1', 'דנה');
insert into public.dispatch_jobs (id, org_id, title, status, driver_id) values
  ('e9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000000', 'משלוח',
   'arrived', 'd9000000-0000-0000-0000-000000000001');

select pg_temp.as_user('00000000-0000-0000-0000-0000000009a1');
do $$ begin
  begin
    update public.dispatch_jobs set status = 'failed', failure_reason = 'the dog ate it'
     where id = 'e9000000-0000-0000-0000-000000000001';
    assert false, 'only a reason from the list';
  exception when check_violation then null;
  end;
  update public.dispatch_jobs set status = 'failed', failure_reason = 'customer_absent'
   where id = 'e9000000-0000-0000-0000-000000000001';
end $$;

reset role;
do $$ begin
  assert (select failure_reason from public.dispatch_jobs) = 'customer_absent',
    'the driver may write the reason';
end $$;

rollback;
