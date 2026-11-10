-- ADM-22: every member reads the dispatcher contact of their own organization; only someone who
-- manages users sets it; the phone is kept as digits.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.permissions (key) values ('users.manage') on conflict do nothing;
insert into public.role_permissions (role, permission) values ('owner', 'users.manage')
  on conflict do nothing;
insert into public.organizations (id, name) values
  ('ac000000-0000-0000-0000-000000000000', 'Contact A'),
  ('ac000000-0000-0000-0000-000000000001', 'Contact B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-000000000ac1', 'ac000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-000000000ac2', 'ac000000-0000-0000-0000-000000000000', 'driver'),
  ('00000000-0000-0000-0000-000000000ac3', 'ac000000-0000-0000-0000-000000000001', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-000000000ac1');
select public.set_org_contact('  דנה כהן ', '050-123 4567');

select pg_temp.as_user('00000000-0000-0000-0000-000000000ac2');
do $$ begin
  assert public.org_contact() = '{"name": "דנה כהן", "phone": "0501234567"}'::jsonb,
    'the driver reads the contact';
  begin
    perform public.set_org_contact('x', '1234567');
    assert false, 'a driver cannot set it';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-000000000ac3');
do $$ begin
  assert public.org_contact() = '{"name": null, "phone": null}'::jsonb, 'another organization';
end $$;

rollback;
