-- BIZ-05: the SIM inventory: valid ICCIDs only, one SIM per device, active when in a device,
-- and only customers.manage writes it.
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
    when 'owner' then p_permission in ('customers.read', 'customers.manage')
    when 'manager' then p_permission = 'customers.read'
    else false end
$$;

insert into public.organizations (id, name) values ('5a000000-0000-0000-0000-000000000000', 'Platform');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000005a1', '5a000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000005a2', '5a000000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-0000000005a3', '5a000000-0000-0000-0000-000000000000', 'driver');

select pg_temp.as_user('00000000-0000-0000-0000-0000000005a1');
do $$ begin
  insert into public.sim_cards (iccid, msisdn, carrier) values
    ('8997201000000000001', '0521234567', 'Partner'),
    ('8997201000000000002', null, 'Partner');
  assert (select status from public.sim_cards where iccid = '8997201000000000001') = 'stock', 'new SIMs are in stock';
  update public.sim_cards set traccar_device_id = 5 where iccid = '8997201000000000001';
  assert (select status from public.sim_cards where iccid = '8997201000000000001') = 'active', 'in a device it is active';
  begin
    update public.sim_cards set traccar_device_id = 5 where iccid = '8997201000000000002';
    assert false, 'one SIM per device';
  exception when unique_violation then null;
  end;
  begin
    insert into public.sim_cards (iccid) values ('12345');
    assert false, 'an ICCID has 18 to 22 digits';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000005a2');
do $$ begin
  assert (select count(*) from public.sim_cards) = 2, 'customers.read reads the inventory';
  begin
    insert into public.sim_cards (iccid) values ('8997201000000000003');
    assert false, 'customers.read does not write it';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000005a3');
do $$ begin
  assert (select count(*) from public.sim_cards) = 0, 'nobody else sees it';
end $$;

rollback;
