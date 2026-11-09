-- What a driver may write (SEC-14): add an incident (with the author set by the database), not
-- rewrite or delete it; on a job only the status along legal steps, the notes and the proof.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a8000000-0000-0000-0000-000000000000', 'Limits A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000008a1', 'a8000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000008a2', 'a8000000-0000-0000-0000-000000000000', 'owner');
insert into public.vehicles (id, org_id, traccar_device_id) values
  ('c8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000', 81);
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000008a1', 'דנה');
insert into public.dispatch_jobs (id, org_id, title, status, driver_id, tracking_link, tracking_expires_at) values
  ('e8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000', 'משלוח', 'assigned',
   'd8000000-0000-0000-0000-000000000001', 'link-1', now() + interval '1 day'),
  ('e8000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000000', 'בוטל', 'cancelled',
   'd8000000-0000-0000-0000-000000000001', null, null);

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a1');
do $$
declare
  v_id uuid;
begin
  -- A report with someone else as the author: the database writes the driver.
  insert into public.incidents (id, org_id, vehicle_id, driver_id, occurred_at, type, reported_by)
  values ('f8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000',
          'c8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', now(), 'damage',
          '00000000-0000-0000-0000-0000000008a2')
  returning id into v_id;
  assert (select reported_by from public.incidents where id = v_id)
    = '00000000-0000-0000-0000-0000000008a1', 'the author is the driver';

  -- Not rewritten, not deleted.
  update public.incidents set type = 'theft' where id = v_id;
  delete from public.incidents where id = v_id;
  assert (select type from public.incidents where id = v_id) = 'damage', 'the report stayed';

  -- A job: the next step, notes and proof, yes; another column, or a jump, no.
  update public.dispatch_jobs set status = 'en_route', notes = 'בדרך'
   where id = 'e8000000-0000-0000-0000-000000000001';
  begin
    update public.dispatch_jobs set tracking_link = 'mine' where id = 'e8000000-0000-0000-0000-000000000001';
    assert false, 'the tracking link is not the driver''s';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.dispatch_jobs set status = 'done' where id = 'e8000000-0000-0000-0000-000000000002';
    assert false, 'a cancelled job does not become done';
  exception when insufficient_privilege then null;
  end;
  update public.dispatch_jobs set status = 'done', proof_name = 'יוסי'
   where id = 'e8000000-0000-0000-0000-000000000001';
  begin
    update public.dispatch_jobs set status = 'en_route' where id = 'e8000000-0000-0000-0000-000000000001';
    assert false, 'a finished job stays finished';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select status from public.dispatch_jobs where id = 'e8000000-0000-0000-0000-000000000001') = 'done',
    'the legal steps went through';
  assert (select started_at is not null from public.dispatch_jobs where id = 'e8000000-0000-0000-0000-000000000001'),
    'the database still fills the times';
end $$;

-- A manager still edits everything.
select pg_temp.as_user('00000000-0000-0000-0000-0000000008a2');
update public.incidents set type = 'theft' where id = 'f8000000-0000-0000-0000-000000000001';
reset role;
do $$ begin
  assert (select type from public.incidents where id = 'f8000000-0000-0000-0000-000000000001') = 'theft',
    'the manager edited';
end $$;

rollback;
\echo 'driver_write_limits.test.sql: all assertions passed'
