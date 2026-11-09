-- Safety officer (ISR-04): procedures for everyone, tachograph records for safety.read, the driver's signature.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a2000000-0000-0000-0000-000000000000', 'Officer A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000002a1', 'a2000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000002a2', 'a2000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000002a3', 'a2000000-0000-0000-0000-000000000000', 'driver');
insert into public.drivers (id, org_id, profile_id, full_name, is_professional) values
  ('d2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000002a2', 'Driver One', true),
  ('d2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000002a3', 'Driver Two', false);
insert into public.safety_reviews (id, org_id, driver_id, kind, held_at, summary) values
  ('5a000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000000', 'd2000000-0000-0000-0000-000000000001', 'periodic', current_date, 'Quarterly meeting');
insert into public.tachograph_downloads (org_id, driver_id, kind, downloaded_at) values
  ('a2000000-0000-0000-0000-000000000000', 'd2000000-0000-0000-0000-000000000001', 'card', current_date);

select pg_temp.as_user('00000000-0000-0000-0000-0000000002a1');
insert into public.safety_procedures (org_id, title) values ('a2000000-0000-0000-0000-000000000000', 'נוהל נהיגה בטוחה');
select public.safety_set_professional('d2000000-0000-0000-0000-000000000002', true);
do $$ begin
  assert (select is_professional from public.drivers where id = 'd2000000-0000-0000-0000-000000000002'), 'owner marks a professional';
end $$;

-- The other driver cannot sign someone else's meeting and does not see their card.
select pg_temp.as_user('00000000-0000-0000-0000-0000000002a3');
do $$ begin
  assert (select count(*) from public.safety_procedures) = 1, 'drivers read the procedures';
  assert (select count(*) from public.tachograph_downloads) = 0, 'not their card';
  begin
    perform public.safety_review_sign('5a000000-0000-0000-0000-000000000001', 'Driver Two');
    assert false, 'cannot sign another driver''s meeting';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.safety_procedures (org_id, title) values ('a2000000-0000-0000-0000-000000000000', 'x');
    assert false, 'drivers do not add procedures';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.safety_set_professional('d2000000-0000-0000-0000-000000000002', true);
    assert false, 'drivers do not mark professionals';
  exception when insufficient_privilege then null;
  end;
  assert public.fleet_file_permission('a2000000-0000-0000-0000-000000000000/procedures/x.pdf', false), 'drivers open procedures';
  assert not public.fleet_file_permission('a2000000-0000-0000-0000-000000000000/procedures/x.pdf', true), 'drivers do not upload them';
  assert not public.fleet_file_permission('a2000000-0000-0000-0000-000000000000/safety/x.pdf', false), 'other safety files stay closed';
end $$;

-- The driver signs their own meeting, once.
select pg_temp.as_user('00000000-0000-0000-0000-0000000002a2');
do $$ begin
  assert (select count(*) from public.tachograph_downloads) = 1, 'their own card';
  perform public.safety_review_sign('5a000000-0000-0000-0000-000000000001', '  Driver One ');
  assert (select driver_signed_name = 'Driver One' and driver_signed_at is not null
            from public.safety_reviews where id = '5a000000-0000-0000-0000-000000000001'), 'signed';
  begin
    perform public.safety_review_sign('5a000000-0000-0000-0000-000000000001', 'Driver One');
    assert false, 'signs once';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo safety_officer.test.sql: all assertions passed
rollback;
