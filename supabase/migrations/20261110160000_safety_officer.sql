-- viper fleet: the safety officer's duties as a work plan (ISR-04, Transport Regulations 585). Idempotent.
--
-- The duties: a documented meeting with every professional driver each quarter, licence and traffic
-- record checks (585א), accident investigations, tachograph records kept for 180 days, a quarterly
-- report to the owner, and licensed garages only. The frequencies are organization settings
-- (org_safety_settings.officer_rules) with defaults in the app, to be checked against the
-- regulations' text.

begin;

-- Professional drivers (heavy vehicles, public transport) get the quarterly meeting.
alter table public.drivers
  add column if not exists is_professional boolean not null default false;

-- The PDF from the government driver-check service, attached to a licence check.
alter table public.driver_license_checks
  add column if not exists document_path text;

-- The driver confirms a meeting's summary in the driver area: their typed name and the time.
alter table public.safety_reviews
  add column if not exists driver_signed_at timestamptz,
  add column if not exists driver_signed_name text;

-- Garages must be licensed by the Ministry of Transport.
alter table public.vendors
  add column if not exists licensed boolean,
  add column if not exists license_number text,
  add column if not exists license_valid_until date;

alter table public.org_safety_settings
  add column if not exists officer_rules jsonb not null default '{}';

-- Procedures, forms and templates the drivers and the officer work by.
create table if not exists public.safety_procedures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  category text not null default 'procedure' check (category in ('procedure', 'form', 'template', 'regulation')),
  version text,
  document_path text,
  published_at date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tachograph downloads (vehicle unit or driver card), with the file, kept at least 180 days.
create table if not exists public.tachograph_downloads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  kind text not null default 'vehicle' check (kind in ('vehicle', 'card')),
  downloaded_at date not null,
  document_path text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (vehicle_id is not null or driver_id is not null)
);

create index if not exists tachograph_downloads_vehicle_idx on public.tachograph_downloads (vehicle_id, downloaded_at desc);
create index if not exists tachograph_downloads_driver_idx on public.tachograph_downloads (driver_id, downloaded_at desc);

do $$
declare
  name text;
begin
  foreach name in array array['safety_procedures', 'tachograph_downloads'] loop
    execute format('drop trigger if exists %I on public.%I', name || '_audit', name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   name || '_audit', name);
    execute format('alter table public.%I enable row level security', name);
    execute format('drop policy if exists %I on public.%I', name || '_write', name);
    execute format(
      'create policy %I on public.%I for all using (org_id = public.current_org_id() and public.has_permission(''safety.write'')) with check (org_id = public.current_org_id() and public.has_permission(''safety.write''))',
      name || '_write', name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', name);
  end loop;
end $$;

-- Everyone in the organization reads the procedures (drivers included); tachograph records are
-- for safety.read, and a driver sees their own card downloads.
drop policy if exists safety_procedures_select on public.safety_procedures;
create policy safety_procedures_select on public.safety_procedures for select
  using (org_id = public.current_org_id());

drop policy if exists tachograph_downloads_select on public.tachograph_downloads;
create policy tachograph_downloads_select on public.tachograph_downloads for select
  using (org_id = public.current_org_id()
         and (public.has_permission('safety.read') or driver_id = public.my_driver_id()));

-- The driver signs a meeting with them, once; nothing else on the row changes.
create or replace function public.safety_review_sign(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(length(trim(p_name)), 0) < 2 then
    raise exception 'Type your full name to sign' using errcode = '22023';
  end if;
  update public.safety_reviews
     set driver_signed_at = now(), driver_signed_name = trim(p_name)
   where id = p_id and driver_id = public.my_driver_id() and driver_signed_at is null;
  if not found then
    raise exception 'This meeting is not waiting for your signature' using errcode = '42501';
  end if;
end $$;

revoke all on function public.safety_review_sign(uuid, text) from public, anon;
grant execute on function public.safety_review_sign(uuid, text) to authenticated;

-- The officer marks professional drivers without needing to edit driver cards.
create or replace function public.safety_set_professional(p_driver uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_permission('safety.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.drivers set is_professional = p_value
   where id = p_driver and org_id = public.current_org_id();
end $$;

revoke all on function public.safety_set_professional(uuid, boolean) from public, anon;
grant execute on function public.safety_set_professional(uuid, boolean) to authenticated;

-- Files: procedures (<org>/procedures/...) are read by everyone in the organization, so drivers
-- can open them; the other areas are as before.
create or replace function public.fleet_file_permission(p_name text, p_write boolean)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (storage.foldername(p_name))[1] = public.current_org_id()::text
     and case (storage.foldername(p_name))[2]
           when 'work-orders' then public.has_permission(case when p_write then 'maintenance.write' else 'maintenance.read' end)
           when 'incidents' then public.has_permission(case when p_write then 'incidents.write' else 'incidents.read' end)
           when 'inspections' then public.has_permission(case when p_write then 'inspections.write' else 'inspections.read' end)
           when 'expenses' then public.has_permission(case when p_write then 'costs.write' else 'costs.read' end)
           when 'safety' then public.has_permission(case when p_write then 'safety.write' else 'safety.read' end)
           when 'procedures' then case when p_write then public.has_permission('safety.write') else true end
           -- Drivers upload proof of delivery for their own jobs with dispatch.read.
           when 'dispatch' then case
             when p_write then public.has_permission('dispatch.write')
                            or (public.is_driver_role() and public.has_permission('dispatch.read'))
             else public.has_permission('dispatch.read') or public.has_permission('dispatch.write')
           end
           else false
         end;
$$;

commit;
