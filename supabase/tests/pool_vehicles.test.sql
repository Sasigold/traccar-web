-- OPS-06: pool vehicles: anyone who reads vehicles asks; a manager approves; approved bookings do
-- not overlap; an expired test blocks; the requester cannot approve their own booking.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a9000000-0000-0000-0000-000000000000', 'Pool A');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000009a1', 'a9000000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-0000000009a2', 'a9000000-0000-0000-0000-000000000000', 'viewer');
insert into public.vehicles (id, org_id, plate_number, pool) values
  ('e9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000000', '11-111-11', true),
  ('e9000000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000000', '22-222-22', true),
  ('e9000000-0000-0000-0000-000000000003', 'a9000000-0000-0000-0000-000000000000', '33-333-33', false);
insert into public.document_types (key) values ('vehicle_test') on conflict do nothing;
insert into public.documents (org_id, vehicle_id, document_type, expires_at) values
  ('a9000000-0000-0000-0000-000000000000', 'e9000000-0000-0000-0000-000000000002', 'vehicle_test',
   current_date + 1);

-- The viewer asks for the first car tomorrow, and tries to approve it alone.
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a2');
insert into public.pool_bookings (id, org_id, vehicle_id, starts_at, ends_at, destination, status)
values ('b9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000000',
        'e9000000-0000-0000-0000-000000000001', now() + interval '1 day',
        now() + interval '1 day 4 hours', 'חיפה', 'approved');
do $$ begin
  assert (select status from public.pool_bookings) = 'requested', 'a request, whatever was sent';
  begin
    update public.pool_bookings set status = 'approved';
    assert false, 'the requester cannot approve';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.pool_bookings (org_id, vehicle_id, starts_at, ends_at)
    values ('a9000000-0000-0000-0000-000000000000', 'e9000000-0000-0000-0000-000000000003',
            now() + interval '1 day', now() + interval '1 day 1 hour');
    assert false, 'not a pool vehicle';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.pool_bookings (org_id, vehicle_id, starts_at, ends_at)
    values ('a9000000-0000-0000-0000-000000000000', 'e9000000-0000-0000-0000-000000000002',
            now() + interval '3 days', now() + interval '3 days 1 hour');
    assert false, 'the test expires before the booking ends';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- The manager approves; a second approved booking that overlaps is refused.
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a1');
update public.pool_bookings set status = 'approved' where id = 'b9000000-0000-0000-0000-000000000001';
insert into public.pool_bookings (id, org_id, vehicle_id, starts_at, ends_at)
values ('b9000000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000000',
        'e9000000-0000-0000-0000-000000000001', now() + interval '1 day 2 hours',
        now() + interval '1 day 6 hours');
do $$ begin
  assert (select decided_by from public.pool_bookings
           where id = 'b9000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000009a1',
    'who approved';
  begin
    update public.pool_bookings set status = 'approved' where id = 'b9000000-0000-0000-0000-000000000002';
    assert false, 'two approved bookings of one car cannot overlap';
  exception when exclusion_violation then null;
  end;
  update public.pool_bookings set status = 'returned', return_odometer_km = 12345, return_check_ok = true
   where id = 'b9000000-0000-0000-0000-000000000001';
  assert (select returned_at from public.pool_bookings
           where id = 'b9000000-0000-0000-0000-000000000001') is not null, 'returned';
end $$;

rollback;
\echo 'pool_vehicles.test.sql: all assertions passed'
