-- Employees' privacy rights (SEC-12): private time stops tracking links, an employee's data can
-- be exported and erased, only with privacy.manage and only in the own organization.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('a6000000-0000-0000-0000-000000000000', 'Rights A'),
  ('b6000000-0000-0000-0000-000000000000', 'Rights B');
insert into public.profiles (id, org_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000006a1', 'a6000000-0000-0000-0000-000000000000', 'admin', 'Admin A'),
  ('00000000-0000-0000-0000-0000000006a2', 'a6000000-0000-0000-0000-000000000000', 'driver', 'Dana Driver'),
  ('00000000-0000-0000-0000-0000000006a3', 'a6000000-0000-0000-0000-000000000000', 'viewer', 'Viewer A'),
  ('00000000-0000-0000-0000-0000000006b1', 'b6000000-0000-0000-0000-000000000000', 'admin', 'Admin B');
insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('e6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000', 961, '11-222-33');
insert into public.drivers (id, org_id, profile_id, full_name, national_id, phone, license_number) values
  ('d6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000006a2', 'דנה לוי', '123456782', '0501234567', 'L-77');
insert into public.vehicle_driver_assignments (org_id, vehicle_id, driver_id, starts_at)
values ('a6000000-0000-0000-0000-000000000000', 'e6000000-0000-0000-0000-000000000001',
        'd6000000-0000-0000-0000-000000000001', now() - interval '1 day');
insert into public.document_types (key) values ('driver_license') on conflict do nothing;
insert into public.documents (org_id, driver_id, document_type, storage_path, file_name)
values ('a6000000-0000-0000-0000-000000000000', 'd6000000-0000-0000-0000-000000000001',
        'driver_license', 'a6000000/drivers/licence.pdf', 'licence.pdf');
insert into public.dispatch_jobs (id, org_id, title, status, vehicle_id, driver_id, tracking_link, tracking_expires_at)
values ('f6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000000', 'משלוח',
        'en_route', 'e6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001',
        'https://example/share?token=t', now() + interval '6 hours');
-- An audit copy with the full row, as the trigger writes it.
insert into public.audit_log (org_id, action, table_name, row_id, new_data)
values ('a6000000-0000-0000-0000-000000000000', 'insert', 'drivers', 'd6000000-0000-0000-0000-000000000001',
        '{"full_name": "דנה לוי", "national_id": "123456782"}');

-- The driver switches to private: the customer's tracking link of the open job stops.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a2');
select public.privacy_private_set(true);
reset role;
do $$ begin
  assert (select tracking_link is null and tracking_expires_at <= now() from public.dispatch_jobs
           where id = 'f6000000-0000-0000-0000-000000000001'), 'the link stops with private time';
end $$;

-- Without privacy.manage, or from another organization: refused.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a3');
do $$ begin
  begin
    perform public.privacy_subject_export('d6000000-0000-0000-0000-000000000001');
    assert false, 'a viewer cannot export';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000006b1');
do $$ begin
  begin
    perform public.privacy_erase_driver('d6000000-0000-0000-0000-000000000001');
    assert false, 'another organization cannot erase';
  exception when no_data_found then null;
  end;
end $$;

-- The export has the driver, the linked profile and every record pointing at the driver.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
do $$
declare
  v jsonb := public.privacy_subject_export('d6000000-0000-0000-0000-000000000001');
begin
  assert v->'driver'->>'national_id' = '123456782', 'the driver row';
  assert v->'profile'->>'full_name' = 'Dana Driver', 'the user profile';
  assert jsonb_array_length(v->'records'->'documents') = 1, 'documents';
  assert jsonb_array_length(v->'records'->'dispatch_jobs') = 1, 'jobs';
  assert jsonb_array_length(v->'records'->'privacy_private_periods') = 1, 'private periods';
  assert jsonb_array_length(v->'records'->'vehicle_driver_assignments') = 1, 'assignments';
  assert exists (select 1 from public.privacy_view_log where view = 'export'
                  and profile_id = '00000000-0000-0000-0000-0000000006a1'), 'the export is logged';
end $$;

-- Erasure: personal details gone, files listed for deletion, audit copies reduced, records kept.
do $$
declare
  v jsonb := public.privacy_erase_driver('d6000000-0000-0000-0000-000000000001');
  d public.drivers;
begin
  assert v->'files' = '[{"bucket": "documents", "path": "a6000000/drivers/licence.pdf"}]'::jsonb,
    format('files to delete: %s', v->'files');
  select * into d from public.drivers where id = 'd6000000-0000-0000-0000-000000000001';
  assert d.full_name = 'נהג שנמחק' and d.national_id is null and d.phone is null
     and d.license_number is null and d.erased_at is not null, 'personal details erased';
  assert not exists (select 1 from public.documents where driver_id = d.id), 'documents deleted';
  assert exists (select 1 from public.dispatch_jobs where driver_id = d.id), 'business records stay';
  assert (select full_name is null and erased_at is not null from public.profiles
           where id = '00000000-0000-0000-0000-0000000006a2'), 'the profile loses its name';
  assert not exists (select 1 from public.audit_log
                      where (new_data::text like '%123456782%' or old_data::text like '%123456782%')),
    'no full copy is left in the audit log';
end $$;

rollback;
\echo 'privacy_rights.test.sql: all assertions passed'
