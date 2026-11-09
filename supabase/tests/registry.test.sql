-- Nightly test-date refresh from data.gov.il: requests per vehicle, answers applied to documents.
\set ON_ERROR_STOP 1
begin;

insert into public.organizations (id, name) values ('a0000000-0000-0000-0000-000000000000', 'Operator');
insert into public.document_types (key, label_he, label_en, applies_to)
values ('vehicle_test', 'טסט', 'Vehicle test', 'vehicle') on conflict do nothing;
insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 1, '12-345-67'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', 2, '751-28-203'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000000', 3, 'ABC'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000000', 4, null);
-- Vehicle 1 has a test date typed on its card (no file), vehicle 2 a scanned licence.
insert into public.documents (org_id, vehicle_id, document_type, expires_at, storage_path) values
  ('a0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'vehicle_test', '2026-01-01', null),
  ('a0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'vehicle_test', '2026-06-01', 'org/vehicles/2/licence.pdf');

do $$ begin
  assert public.gov_registry_request() = 4, 'two lookups (one per resource) for each vehicle with a valid plate';
  assert (select count(*) from net.http_request_queue
           where params->>'filters' = '{"mispar_rechev": 1234567}') = 2, 'plate sent as digits';
end $$;

-- The registry answers: vehicle 1 in the first resource, vehicle 2 in the first, the second
-- resource has nothing for 1 and fails for 2.
insert into net._http_response (id, status_code, content)
select q.request_id,
       case when v.traccar_device_id = 2 and r.n = 2 then 500 else 200 end,
       case
         when r.n = 1 and v.traccar_device_id = 1 then '{"result":{"records":[{"tokef_dt":"2027-03-01"}]}}'
         when r.n = 1 and v.traccar_device_id = 2 then '{"result":{"records":[{"tokef_dt":"2027-05-05"}]}}'
         when v.traccar_device_id = 2 then 'Internal error'
         else '{"result":{"records":[]}}'
       end
  from public.gov_registry_requests q
  join public.vehicles v on v.id = q.vehicle_id
  join (select request_id, row_number() over (partition by vehicle_id order by request_id) as n
          from public.gov_registry_requests) r on r.request_id = q.request_id;

do $$ begin
  assert public.gov_registry_apply() = 2, 'two vehicles changed';
  assert (select expires_at from public.documents
           where vehicle_id = 'e0000000-0000-0000-0000-000000000001') = '2027-03-01',
         'a typed date moves to the registry date';
  assert (select count(*) from public.documents
           where vehicle_id = 'e0000000-0000-0000-0000-000000000002') = 2,
         'a scanned licence is kept and a new date is added';
  assert (select max(expires_at) from public.documents
           where vehicle_id = 'e0000000-0000-0000-0000-000000000002') = '2027-05-05',
         'the new document carries the registry date';
  assert (select array_agg(outcome order by outcome) from public.gov_registry_requests)
       = array['error', 'not_found', 'updated', 'updated'], 'outcomes recorded';
  assert public.gov_registry_apply() = 0, 'answers are applied once';
end $$;

-- A second night with the same dates changes nothing.
delete from public.gov_registry_requests;
delete from net._http_response;
do $$ begin
  perform public.gov_registry_request();
end $$;
insert into net._http_response (id, status_code, content)
select q.request_id, 200, '{"result":{"records":[{"tokef_dt":"2027-03-01"}]}}'
  from public.gov_registry_requests q
 where q.vehicle_id = 'e0000000-0000-0000-0000-000000000001';
do $$ begin
  assert public.gov_registry_apply() = 0, 'same date: unchanged';
  assert (select count(*) from public.gov_registry_requests where outcome = 'unchanged') = 2,
         'both answers for vehicle 1 are unchanged';
end $$;

rollback;
\echo 'registry.test.sql: all assertions passed'
