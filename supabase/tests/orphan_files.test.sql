-- SEC-17: the files of an organization that no row points to, past the grace period; only its
-- owner or admin asks, and never about another organization's files.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into storage.buckets (id, name) values ('fleet-files', 'fleet-files') on conflict do nothing;
insert into public.organizations (id, name) values
  ('e8000000-0000-0000-0000-000000000000', 'Files A'),
  ('f8000000-0000-0000-0000-000000000000', 'Files B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000e8001', 'e8000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000e8002', 'e8000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-0000000f8001', 'f8000000-0000-0000-0000-000000000000', 'owner');

-- A's files: one a vehicle expense points to, one an issue's photos point to, one orphan, one
-- orphan too new to judge. B has an orphan of its own.
insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-000000000000', 9801, '81-111-81');
insert into storage.objects (bucket_id, name, metadata, created_at) values
  ('fleet-files', 'e8000000-0000-0000-0000-000000000000/expenses/kept.pdf', '{"size": 100}', now() - interval '60 days'),
  ('fleet-files', 'e8000000-0000-0000-0000-000000000000/issues/photo.jpg', '{"size": 200}', now() - interval '60 days'),
  ('fleet-files', 'e8000000-0000-0000-0000-000000000000/expenses/orphan.pdf', '{"size": 300}', now() - interval '60 days'),
  ('fleet-files', 'e8000000-0000-0000-0000-000000000000/inspections/new.jpg', '{"size": 400}', now() - interval '2 days'),
  ('fleet-files', 'f8000000-0000-0000-0000-000000000000/expenses/b.pdf', '{"size": 500}', now() - interval '60 days');
insert into public.vehicle_expenses (org_id, vehicle_id, category, amount, occurred_at, receipt_path)
values ('e8000000-0000-0000-0000-000000000000', 'e8000000-0000-0000-0000-0000000000a1', 'other', 10, current_date,
        'e8000000-0000-0000-0000-000000000000/expenses/kept.pdf');
insert into public.issues (org_id, vehicle_id, title, photos)
values ('e8000000-0000-0000-0000-000000000000', 'e8000000-0000-0000-0000-0000000000a1', 'שריטה',
        array['e8000000-0000-0000-0000-000000000000/issues/photo.jpg']);

select pg_temp.as_user('00000000-0000-0000-0000-0000000e8001');
do $$ begin
  assert (select array_agg(name) from public.fleet_orphan_files())
       = array['e8000000-0000-0000-0000-000000000000/expenses/orphan.pdf'], 'one orphan of A';
  assert (select size from public.fleet_orphan_files()) = 300, 'with its size';
  begin
    perform public.fleet_orphan_files(interval '1 day');
    assert false, 'a grace period of at least 7 days';
  exception when invalid_parameter_value then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000e8002');
do $$ begin
  perform public.fleet_orphan_files();
  assert false, 'a viewer cannot ask';
exception when insufficient_privilege then null;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000f8001');
do $$ begin
  assert (select array_agg(name) from public.fleet_orphan_files())
       = array['f8000000-0000-0000-0000-000000000000/expenses/b.pdf'], 'B sees only its own';
  begin
    perform public.fleet_referenced_paths();
    assert false, 'the inner function is not for callers';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
\echo 'orphan_files.test.sql: all assertions passed'
