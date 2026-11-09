-- Row level security tests: platform data, driver scoping, files.
-- Runs inside one transaction that is rolled back. Users are switched with set_config on
-- request.jwt.claim.sub and the authenticated role, as PostgREST does.
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

-- ─── fixtures ───────────────────────────────────────────────────────────────
insert into public.organizations (id, name) values
  ('a0000000-0000-0000-0000-000000000000', 'Operator'),
  ('b0000000-0000-0000-0000-000000000000', 'Customer B');

insert into public.profiles (id, org_id, role, traccar_user_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000000', 'owner', 1),
  ('00000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000000', 'admin', 2),
  ('00000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000000', 'driver', 4),
  ('00000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-000000000000', 'driver', 5),
  ('00000000-0000-0000-0000-0000000000a5', 'a0000000-0000-0000-0000-000000000000', 'viewer', 6),
  ('00000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000000', 'owner', 3);

insert into public.customers (id, name) values ('c0000000-0000-0000-0000-000000000000', 'Customer B');
insert into public.customer_users (traccar_user_id, customer_id) values (3, 'c0000000-0000-0000-0000-000000000000');

insert into public.vehicles (id, org_id, traccar_device_id) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 101);
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3', 'Driver One'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a4', 'Driver Two');

insert into public.incidents (id, org_id, vehicle_id, driver_id, occurred_at, reported_by) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', now(), '00000000-0000-0000-0000-0000000000a3'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', now(), '00000000-0000-0000-0000-0000000000a4');
insert into public.incident_parties (org_id, incident_id, name, national_id) values
  ('a0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'Party One', '000000018'),
  ('a0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'Party Two', '000000026');
insert into public.insurance_claims (org_id, incident_id, insurer) values
  ('a0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'Insurer Two');

insert into storage.buckets (id, name) values ('fleet-files', 'fleet-files') on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('fleet-files', 'a0000000-0000-0000-0000-000000000000/incidents/photo.jpg');

-- ─── seed of platform administrators ────────────────────────────────────────
delete from public.platform_admins;
select public.seed_platform_admins();
do $$ begin
  assert (select array_agg(user_id::text order by user_id) from public.platform_admins)
       = array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'],
         'seed: operator owner and admin, not the customer owner';
end $$;

-- ─── platform data ──────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert not public.has_permission('customers.manage'), 'customer owner has no customers.manage';
  assert not public.has_permission('billing.read'), 'customer owner has no billing.read';
  assert public.has_permission('incidents.write'), 'customer owner keeps organization permissions';
  assert (select count(*) from public.customers) = 0, 'customer owner reads no customers';
  begin
    insert into public.customers (name) values ('Injected');
    assert false, 'customer owner must not insert customers';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert public.has_permission('customers.manage'), 'platform admin has customers.manage';
  assert (select count(*) from public.customers) = 1, 'platform admin reads customers';
end $$;

-- An organization override can no longer hand out platform keys.
select pg_temp.as_admin();
insert into public.user_permissions (user_id, permission, granted)
values ('00000000-0000-0000-0000-0000000000b1', 'billing.manage', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert not public.has_permission('billing.manage'), 'override cannot grant billing.manage';
end $$;

-- ─── drivers reach only their own incident children ─────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$
declare
  changed integer;
begin
  assert (select count(*) from public.incidents) = 1, 'driver sees own incident only';
  assert (select count(*) from public.incident_parties) = 1, 'driver sees own parties only';
  assert (select name from public.incident_parties) = 'Party One', 'driver sees the right party';
  assert (select count(*) from public.insurance_claims) = 0, 'driver sees no foreign claim';
  update public.incident_parties set name = 'X' where incident_id = '10000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  assert changed = 0, 'driver cannot change foreign parties';
  begin
    insert into public.incident_parties (org_id, incident_id, name)
    values ('a0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'Y');
    assert false, 'driver must not add parties to a foreign incident';
  exception when insufficient_privilege then null;
  end;
  insert into public.incident_parties (org_id, incident_id, name)
  values ('a0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'Witness');
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  assert (select count(*) from public.incident_parties) = 3, 'admin sees every party';
  assert (select count(*) from public.insurance_claims) = 1, 'admin sees claims';
end $$;

-- ─── files ──────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
do $$ begin
  assert not public.fleet_file_permission('a0000000-0000-0000-0000-000000000000/dispatch/pod.jpg', true),
         'viewer cannot write proof of delivery';
end $$;

select pg_temp.as_admin();
insert into public.role_permissions (role, permission) values ('driver', 'dispatch.read') on conflict do nothing;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$
declare
  removed integer;
begin
  assert public.fleet_file_permission('a0000000-0000-0000-0000-000000000000/dispatch/pod.jpg', true),
         'driver uploads proof of delivery';
  delete from storage.objects where name like '%/incidents/photo.jpg';
  get diagnostics removed = row_count;
  assert removed = 0, 'driver cannot delete incident evidence';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$
declare
  removed integer;
begin
  delete from storage.objects where name like '%/incidents/photo.jpg';
  get diagnostics removed = row_count;
  assert removed = 1, 'admin can delete incident files';
end $$;

rollback;
\echo 'security.test.sql: all assertions passed'
