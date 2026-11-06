-- viper fleet roadmap, stage 4: driver safety and the transport safety officer.
-- Idempotent. The new role value is added outside the transaction (Postgres can't use an enum
-- value in the transaction that created it).

alter type public.app_role add value if not exists 'safety_officer';

begin;

insert into public.permissions (key, description) values
  ('safety.read', 'View driver safety: scores, driving hours, violations, trainings'),
  ('safety.write', 'Record violations, trainings, license checks and safety reviews')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission)
select role::public.app_role, permission
  from (values
    ('admin', 'safety.read'), ('admin', 'safety.write'),
    ('manager', 'safety.read'), ('manager', 'safety.write'),
    ('safety_officer', 'safety.read'), ('safety_officer', 'safety.write'),
    ('safety_officer', 'vehicles.read'), ('safety_officer', 'drivers.read'),
    ('safety_officer', 'drivers.write'), ('safety_officer', 'documents.read'),
    ('safety_officer', 'documents.write'), ('safety_officer', 'incidents.read'),
    ('safety_officer', 'incidents.write'), ('safety_officer', 'inspections.read'),
    ('safety_officer', 'maintenance.read'), ('safety_officer', 'reports.read'),
    ('safety_officer', 'audit.read'), ('safety_officer', 'alerts.read')
  ) as grants (role, permission)
on conflict do nothing;

-- Traffic and parking violations and fines, assigned to the driver who drove.
create table if not exists public.driver_violations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  occurred_at timestamptz not null,
  type text not null default 'speeding'
    check (type in ('speeding', 'red_light', 'parking', 'phone', 'seatbelt', 'lane', 'other')),
  authority text,
  reference_no text,
  location text,
  fine_amount numeric,
  points integer,
  status text not null default 'open'
    check (status in ('open', 'assigned', 'transferred', 'paid', 'appealed', 'closed')),
  due_at date,
  document_path text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_trainings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  topic text not null,
  held_at date not null,
  hours numeric,
  trainer text,
  valid_until date,
  certificate_path text,
  signed_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- License checks with the licensing authority (regulation 585: every 6 months for hired drivers).
create table if not exists public.driver_license_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  checked_at date not null,
  source text not null default 'manual' check (source in ('manual', 'licensing_office', 'online')),
  license_valid boolean not null default true,
  findings text,
  recommendation text,
  next_check_at date,
  checked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Conversations, investigations and periodic reviews with a driver.
create table if not exists public.safety_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  incident_id uuid references public.incidents (id) on delete set null,
  kind text not null default 'conversation' check (kind in ('conversation', 'investigation', 'periodic')),
  held_at date not null,
  summary text,
  decisions text,
  follow_up_at date,
  reviewer_id uuid references public.profiles (id) on delete set null,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Per organization: score weights and driving / rest limits (parameters, not code).
create table if not exists public.org_safety_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  score_weights jsonb not null default '{}',
  hours_rules jsonb not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists driver_violations_driver_idx on public.driver_violations (driver_id, occurred_at desc);
create index if not exists driver_trainings_driver_idx on public.driver_trainings (driver_id, held_at desc);
create index if not exists driver_license_checks_driver_idx on public.driver_license_checks (driver_id, checked_at desc);
create index if not exists safety_reviews_driver_idx on public.safety_reviews (driver_id, held_at desc);

drop trigger if exists driver_violations_updated_at on public.driver_violations;
create trigger driver_violations_updated_at before update on public.driver_violations
  for each row execute function public.set_updated_at();

do $$
declare
  name text;
begin
  foreach name in array array['driver_violations', 'driver_trainings', 'driver_license_checks', 'safety_reviews'] loop
    execute format('drop trigger if exists %I on public.%I', name || '_audit', name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   name || '_audit', name);
    execute format('alter table public.%I enable row level security', name);
    execute format('drop policy if exists %I on public.%I', name || '_select', name);
    execute format(
      'create policy %I on public.%I for select using (org_id = public.current_org_id() and (public.has_permission(''safety.read'') or driver_id = public.my_driver_id()))',
      name || '_select', name);
    execute format('drop policy if exists %I on public.%I', name || '_write', name);
    execute format(
      'create policy %I on public.%I for all using (org_id = public.current_org_id() and public.has_permission(''safety.write'')) with check (org_id = public.current_org_id() and public.has_permission(''safety.write''))',
      name || '_write', name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', name);
  end loop;
end $$;

alter table public.org_safety_settings enable row level security;

drop policy if exists org_safety_settings_select on public.org_safety_settings;
create policy org_safety_settings_select on public.org_safety_settings for select
  using (org_id = public.current_org_id());

drop policy if exists org_safety_settings_write on public.org_safety_settings;
create policy org_safety_settings_write on public.org_safety_settings for all
  using (org_id = public.current_org_id() and public.has_permission('safety.write'))
  with check (org_id = public.current_org_id() and public.has_permission('safety.write'));

grant select, insert, update, delete on public.org_safety_settings to authenticated;

-- Safety files: <org_id>/safety/... in fleet-files, guarded by safety.read / safety.write.
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
           else false
         end;
$$;

commit;
