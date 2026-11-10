-- Fuel check settings (OPS-02): each organization keeps its own; a viewer cannot change them.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('a7000000-0000-0000-0000-000000000000', 'Fuel A'),
  ('b7000000-0000-0000-0000-000000000000', 'Fuel B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000007a1', 'a7000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000007a2', 'a7000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-0000000007b1', 'b7000000-0000-0000-0000-000000000000', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-0000000007a1');
insert into public.org_fuel_settings (org_id, rules, fuel_price)
values ('a7000000-0000-0000-0000-000000000000', '{"fuelDrop": false}', 7.42);
do $$ begin
  begin
    insert into public.org_fuel_settings (org_id, fuel_price)
    values ('b7000000-0000-0000-0000-000000000000', 7);
    assert false, 'not another organization';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.org_fuel_settings set fuel_price = 500;
    assert false, 'a price out of range';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000007b1');
do $$ begin
  assert (select count(*) from public.org_fuel_settings) = 0, 'another organization sees nothing';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000007a2');
do $$ begin
  update public.org_fuel_settings set fuel_price = 9;
end $$;
reset role;
do $$ begin
  assert (select fuel_price from public.org_fuel_settings) = 7.42, 'the viewer changed nothing';
end $$;

rollback;
\echo 'fuel_checks.test.sql: all assertions passed'
