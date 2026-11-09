-- viper fleet: nightly vehicle test ("tokef") refresh from the government registry (ISR-01).
-- Idempotent.
--
-- data.gov.il publishes the Ministry of Transport's vehicle registry with each vehicle's licence
-- ("test") expiry. Every night every vehicle with a plate number is looked up (pg_net, two
-- resources since the dataset is split), and half an hour later the answers are applied: the
-- vehicle's latest test document takes the registry date. A document without a file has its date
-- moved; one with a scanned file is kept and a new one is added (the same rule as saving a card).
--
-- If pg_net is not available the functions exist but nothing is scheduled (a notice says so); the
-- same refresh can be run from the validity page.

begin;

create table if not exists public.gov_registry_requests (
  request_id bigint primary key,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  org_id uuid not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (outcome in ('updated', 'unchanged', 'not_found', 'error'))
);

comment on table public.gov_registry_requests is
  'Pending and recent data.gov.il lookups of the nightly test-date refresh (internal).';

alter table public.gov_registry_requests enable row level security;
revoke all on public.gov_registry_requests from anon, authenticated;

-- Ask the registry about every vehicle with a plate (5 to 8 digits). Returns the requests made.
create or replace function public.gov_registry_request()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  vehicle record;
  resource text;
  resources text[] := array[
    '053cea08-09bc-40ec-8f7a-156f0677aff3',
    '0866573c-40cd-4ca8-91d2-9dd2d7a492e5'
  ];
  made integer := 0;
begin
  for vehicle in
    select v.id, v.org_id, regexp_replace(v.plate_number, '\D', '', 'g') as digits
      from public.vehicles v
     where v.plate_number is not null
  loop
    continue when vehicle.digits !~ '^\d{5,8}$';
    foreach resource in array resources loop
      insert into public.gov_registry_requests (request_id, vehicle_id, org_id)
      values (
        net.http_get(
          url := 'https://data.gov.il/api/3/action/datastore_search',
          params := jsonb_build_object(
            'resource_id', resource,
            'limit', '1',
            'filters', jsonb_build_object('mispar_rechev', vehicle.digits::bigint)::text
          ),
          timeout_milliseconds := 20000
        ),
        vehicle.id,
        vehicle.org_id
      );
      made := made + 1;
    end loop;
  end loop;
  return made;
end;
$$;

-- Apply the answers that have arrived. Returns the vehicles whose test date changed.
create or replace function public.gov_registry_apply()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  answer record;
  expiry date;
  latest record;
  changed integer := 0;
  has_type boolean := exists (select 1 from public.document_types where key = 'vehicle_test');
begin
  for answer in
    select q.request_id, q.vehicle_id, q.org_id, r.status_code, r.content
      from public.gov_registry_requests q
      join net._http_response r on r.id = q.request_id
     where q.processed_at is null
     order by q.requested_at
  loop
    expiry := null;
    begin
      if answer.status_code = 200 then
        expiry := nullif(answer.content::jsonb #>> '{result,records,0,tokef_dt}', '')::date;
      end if;
    exception when others then
      expiry := null;
    end;

    if expiry is null then
      update public.gov_registry_requests
         set processed_at = now(),
             outcome = case when answer.status_code = 200 then 'not_found' else 'error' end
       where request_id = answer.request_id;
      continue;
    end if;

    select d.id, d.expires_at, d.storage_path
      into latest
      from public.documents d
     where d.vehicle_id = answer.vehicle_id and d.document_type = 'vehicle_test'
     order by d.expires_at desc nulls last, d.created_at desc
     limit 1;

    if found and latest.expires_at is not distinct from expiry then
      update public.gov_registry_requests set processed_at = now(), outcome = 'unchanged'
       where request_id = answer.request_id;
    elsif found and latest.storage_path is null then
      update public.documents set expires_at = expiry where id = latest.id;
      update public.gov_registry_requests set processed_at = now(), outcome = 'updated'
       where request_id = answer.request_id;
      changed := changed + 1;
    elsif has_type then
      insert into public.documents (org_id, vehicle_id, document_type, expires_at, notes)
      values (answer.org_id, answer.vehicle_id, 'vehicle_test', expiry, 'data.gov.il');
      update public.gov_registry_requests set processed_at = now(), outcome = 'updated'
       where request_id = answer.request_id;
      changed := changed + 1;
    else
      update public.gov_registry_requests set processed_at = now(), outcome = 'error'
       where request_id = answer.request_id;
    end if;
  end loop;

  -- pg_net keeps answers for a few hours: what never came back is closed as an error, and old
  -- rows are removed.
  update public.gov_registry_requests set processed_at = now(), outcome = 'error'
   where processed_at is null and requested_at < now() - interval '1 day';
  delete from public.gov_registry_requests where requested_at < now() - interval '14 days';

  return changed;
end;
$$;

revoke all on function public.gov_registry_request() from public, anon, authenticated;
revoke all on function public.gov_registry_apply() from public, anon, authenticated;

commit;

-- Scheduling, outside the transaction (like the other pg_cron jobs): 01:30 UTC lookups, 02:00 UTC
-- answers, before the 04:00 document alerts. Only where pg_net is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    perform cron.unschedule(jobid) from cron.job
     where jobname in ('vf_gov_registry_request', 'vf_gov_registry_apply');
    perform cron.schedule('vf_gov_registry_request', '30 1 * * *',
                          'select public.gov_registry_request()');
    perform cron.schedule('vf_gov_registry_apply', '0 2 * * *',
                          'select public.gov_registry_apply()');
  else
    raise notice 'pg_net is not available: the nightly registry refresh is not scheduled';
  end if;
end;
$$;
