-- The safety inbox (SAF-01): managers review their organization's events; a driver reads only
-- their own events sent for self-review and answers each once, through the function.
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
  ('a5000000-0000-0000-0000-000000000000', 'Safety A'),
  ('b5000000-0000-0000-0000-000000000000', 'Safety B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000005a1', 'a5000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000005a2', 'a5000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000005a3', 'a5000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-0000000005b1', 'b5000000-0000-0000-0000-000000000000', 'owner');
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000005a2', 'דנה'),
  ('d5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000005a3', 'יוסי');

-- The owner (full permissions by role) reviews: two events, one sent to Dana.
select pg_temp.as_user('00000000-0000-0000-0000-0000000005a1');
insert into public.safety_event_reviews
  (id, org_id, traccar_event_id, traccar_device_id, driver_id, category, occurred_at, status, self_review)
values
  ('e5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000000', 101, 1,
   'd5000000-0000-0000-0000-000000000001', 'hardBraking', now(), 'coaching', true),
  ('e5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000000', 102, 1,
   'd5000000-0000-0000-0000-000000000001', 'overspeed', now(), 'dismissed', false);
do $$ begin
  assert (select count(*) from public.safety_event_reviews) = 2, 'the owner sees both';
end $$;

-- Another organization sees nothing.
select pg_temp.as_user('00000000-0000-0000-0000-0000000005b1');
do $$ begin
  assert (select count(*) from public.safety_event_reviews) = 0, 'no other organization';
end $$;

-- Dana sees only the event sent to her, answers it once, and cannot change anything else.
select pg_temp.as_user('00000000-0000-0000-0000-0000000005a2');
do $$ begin
  assert (select count(*) from public.safety_event_reviews) = 1, 'only her self-review';
  perform public.safety_driver_ack('e5000000-0000-0000-0000-000000000001', 'my_mistake');
  begin
    perform public.safety_driver_ack('e5000000-0000-0000-0000-000000000001', 'other');
    assert false, 'answered once';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.safety_driver_ack('e5000000-0000-0000-0000-000000000002', 'other');
    assert false, 'not sent to her';
  exception when insufficient_privilege then null;
  end;
  update public.safety_event_reviews set status = 'dismissed';
end $$;

-- Yossi cannot answer Dana's event.
select pg_temp.as_user('00000000-0000-0000-0000-0000000005a3');
do $$ begin
  begin
    perform public.safety_driver_ack('e5000000-0000-0000-0000-000000000001', 'other');
    assert false, 'not his event';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_admin();
do $$ begin
  assert (select driver_answer from public.safety_event_reviews
           where id = 'e5000000-0000-0000-0000-000000000001') = 'my_mistake', 'the answer';
  assert (select status from public.safety_event_reviews
           where id = 'e5000000-0000-0000-0000-000000000001') = 'coaching', 'the driver changed nothing else';
end $$;

rollback;
\echo 'safety_inbox.test.sql: all assertions passed'
