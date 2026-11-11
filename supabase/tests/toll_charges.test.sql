-- ISR-06: a toll statement is kept once per charge; costs.write marks private use and cost
-- centers, costs.read only reads, another organization sees nothing.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select case public.current_role_name()
    when 'owner' then p_permission in ('costs.read', 'costs.write')
    when 'viewer' then p_permission = 'costs.read'
    else false end
$$;

insert into public.organizations (id, name) values
  ('c7000000-0000-0000-0000-000000000000', 'Tolls A'),
  ('d7000000-0000-0000-0000-000000000000', 'Tolls B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000c7001', 'c7000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000c7002', 'c7000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-0000000d7001', 'd7000000-0000-0000-0000-000000000000', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-0000000c7001');
insert into public.toll_charges (org_id, plate, charged_at, amount, operator, status, cost_center)
values ('c7000000-0000-0000-0000-000000000000', '12-345-67', '2026-11-02 07:10+02', 18.40, 'כביש 6', 'matched', 'מכירות');
-- The same charge again (a statement imported twice) is ignored.
insert into public.toll_charges (org_id, plate, charged_at, amount, operator, status)
values ('c7000000-0000-0000-0000-000000000000', '12-345-67', '2026-11-02 07:10+02', 18.40, 'כביש 6', 'matched')
on conflict (org_id, plate, charged_at, amount) do nothing;
update public.toll_charges set private = true where plate = '12-345-67';
do $$ begin
  assert (select count(*) from public.toll_charges) = 1, 'kept once';
  assert (select private from public.toll_charges), 'marked private';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000c7002');
do $$ begin
  assert (select count(*) from public.toll_charges) = 1, 'the viewer reads';
  update public.toll_charges set private = false;
  assert (select private from public.toll_charges), 'the viewer cannot mark';
  begin
    insert into public.toll_charges (org_id, plate, charged_at, amount)
    values ('c7000000-0000-0000-0000-000000000000', '1', now(), 1);
    assert false, 'the viewer cannot import';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000d7001');
do $$ begin
  assert (select count(*) from public.toll_charges) = 0, 'another organization sees nothing';
  begin
    insert into public.toll_charges (org_id, plate, charged_at, amount)
    values ('c7000000-0000-0000-0000-000000000000', '1', now(), 1);
    assert false, 'not into another organization';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
\echo 'toll_charges.test.sql: all assertions passed'
