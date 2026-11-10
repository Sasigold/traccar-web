-- ISR-13: agreed supplier prices: only maintenance writes them, only for the organization's
-- own suppliers, and other organizations see nothing.
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
    when 'owner' then p_permission in ('maintenance.read', 'maintenance.write')
    when 'manager' then p_permission = 'maintenance.read'
    else false end
$$;

insert into public.organizations (id, name) values
  ('8a000000-0000-0000-0000-000000000000', 'Fleet A'),
  ('8b000000-0000-0000-0000-000000000000', 'Fleet B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000008a1', '8a000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000008a2', '8a000000-0000-0000-0000-000000000000', 'manager'),
  ('00000000-0000-0000-0000-0000000008b1', '8b000000-0000-0000-0000-000000000000', 'owner');
insert into public.vendors (id, org_id, name) values
  ('8a000000-0000-0000-0000-0000000000d1', '8a000000-0000-0000-0000-000000000000', 'מוסך א'),
  ('8b000000-0000-0000-0000-0000000000d1', '8b000000-0000-0000-0000-000000000000', 'מוסך ב');

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a1');
do $$ begin
  insert into public.vendor_prices (org_id, vendor_id, description, kind, unit_price) values
    ('8a000000-0000-0000-0000-000000000000', '8a000000-0000-0000-0000-0000000000d1', 'החלפת שמן', 'labor', 200),
    ('8a000000-0000-0000-0000-000000000000', null, 'רפידות בלם', 'part', 350);
  assert (select tolerance_pct from public.vendor_prices limit 1) = 5, 'five percent by default';
  begin
    insert into public.vendor_prices (org_id, vendor_id, description, unit_price)
    values ('8a000000-0000-0000-0000-000000000000', '8b000000-0000-0000-0000-0000000000d1', 'x y', 1);
    assert false, 'not for another organization''s supplier';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.vendor_prices (org_id, description, unit_price, valid_from, valid_to)
    values ('8a000000-0000-0000-0000-000000000000', 'טווח', 1, '2026-02-01', '2026-01-01');
    assert false, 'a valid range ends after it starts';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000008a2');
do $$ begin
  assert (select count(*) from public.vendor_prices) = 2, 'maintenance.read reads the list';
  begin
    insert into public.vendor_prices (org_id, description, unit_price)
    values ('8a000000-0000-0000-0000-000000000000', 'עוד', 1);
    assert false, 'and does not write it';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000008b1');
do $$ begin
  assert (select count(*) from public.vendor_prices) = 0, 'another organization sees nothing';
end $$;

rollback;
\echo 'vendor_prices.test.sql: all assertions passed'
