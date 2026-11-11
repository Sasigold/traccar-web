-- SAF-05, SEC-23: a driver disagrees with an event of their own, once; the manager's decision
-- answers it; the driver reads their disputes and their own periods, and nobody else's.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('a6000000-0000-0000-0000-000000000000', 'Disputes A'),
  ('b6000000-0000-0000-0000-000000000000', 'Disputes B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000006a1', 'a6000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000006a2', 'a6000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000006a3', 'a6000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000006b2', 'b6000000-0000-0000-0000-000000000000', 'driver');
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000006a2', 'דנה'),
  ('d6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000006a3', 'יוסי'),
  ('d6000000-0000-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000006b2', 'רון');
insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('a6000000-0000-0000-0000-0000000000c1', 'a6000000-0000-0000-0000-000000000000', 9601, '61-111-61'),
  ('a6000000-0000-0000-0000-0000000000c2', 'a6000000-0000-0000-0000-000000000000', 9602, '62-222-62');
-- Dana had c1 two days ago until yesterday, and has c2 since; Yossi has c1 since yesterday.
insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at, ends_at) values
  ('a6000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-0000000000c1', 'd6000000-0000-0000-0000-000000000001', now() - interval '2 days', now() - interval '1 day'),
  ('a6000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-0000000000c2', 'd6000000-0000-0000-0000-000000000001', now() - interval '1 day', null),
  ('a6000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-0000000000c1', 'd6000000-0000-0000-0000-000000000002', now() - interval '1 day', null);

select pg_temp.as_user('00000000-0000-0000-0000-0000000006a2');
do $$ begin
  -- Both periods, including the vehicle she no longer has.
  assert (select count(*) from public.driver_my_periods()) = 2, 'Dana reads her two periods';
  assert (select array_agg(traccar_device_id order by starts_at) from public.driver_my_periods()) = '{9601,9602}',
    'by Traccar id';

  -- An event on c1 while she had it: disputed, a review appears, pending.
  perform public.safety_driver_dispute(601, 9601, 'overspeed', now() - interval '36 hours', 'device_error', 'GPS קפץ');
  assert (select count(*) from public.safety_event_reviews) = 1, 'she reads her dispute';
  assert (select status from public.safety_event_reviews where traccar_event_id = 601) = 'pending', 'pending';

  -- Twice: refused.
  begin
    perform public.safety_driver_dispute(601, 9601, 'overspeed', now() - interval '36 hours', 'other');
    assert false, 'once only';
  exception when insufficient_privilege then null;
  end;
  -- An event on c1 after she gave it back (Yossi's): refused.
  begin
    perform public.safety_driver_dispute(602, 9601, 'overspeed', now() - interval '2 hours', 'not_me');
    assert false, 'not her period';
  exception when insufficient_privilege then null;
  end;
  -- An unknown reason: refused.
  begin
    perform public.safety_driver_dispute(603, 9602, 'overspeed', now() - interval '2 hours', 'because');
    assert false, 'unknown reason';
  exception when invalid_parameter_value then null;
  end;
  -- She cannot answer it herself.
  update public.safety_event_reviews set status = 'dismissed' where traccar_event_id = 601;
  assert (select status from public.safety_event_reviews where traccar_event_id = 601) = 'pending',
    'a driver cannot decide';
end $$;

-- Yossi sees neither Dana's periods nor her dispute.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a3');
do $$ begin
  assert (select count(*) from public.driver_my_periods()) = 1, 'only his own period';
  assert (select count(*) from public.safety_event_reviews) = 0, 'not her dispute';
end $$;

-- A driver of another organization cannot dispute A's vehicles.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006b2');
do $$ begin
  perform public.safety_driver_dispute(604, 9602, 'overspeed', now() - interval '2 hours', 'not_me');
  assert false, 'another organization';
exception when insufficient_privilege then null;
end $$;

-- The owner dismisses it: the dispute is accepted. Reopening clears the answer; coaching rejects.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
do $$ begin
  update public.safety_event_reviews set status = 'dismissed' where traccar_event_id = 601;
  assert (select dispute_result from public.safety_event_reviews where traccar_event_id = 601) = 'accepted', 'accepted';
  update public.safety_event_reviews set status = 'pending' where traccar_event_id = 601;
  assert (select dispute_result from public.safety_event_reviews where traccar_event_id = 601) is null, 'reopened';
  update public.safety_event_reviews set status = 'coaching' where traccar_event_id = 601;
  assert (select dispute_result from public.safety_event_reviews where traccar_event_id = 601) = 'rejected', 'rejected';
end $$;

-- Dana reads the answer.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a2');
do $$ begin
  assert (select dispute_result from public.safety_event_reviews where traccar_event_id = 601) = 'rejected',
    'the driver reads the answer';
end $$;

rollback;
\echo 'driver_disputes.test.sql: all assertions passed'
