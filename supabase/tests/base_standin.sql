-- Stand-in for the parts of the Viper Fleet database that live only on the VPS (the Supabase
-- platform schemas and the base schema the repo migrations build on). Used to apply
-- supabase/migrations/*.sql to a plain local Postgres and run the RLS tests
-- (supabase/tests/run.sh). Column lists cover what the migrations and the UI use.

create extension if not exists pgcrypto;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;

-- auth: the JWT subject comes from a setting, as in Supabase.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;

-- storage
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text not null, owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

-- pg_net stand-in: requests are recorded, the tests insert the answers.
create schema if not exists net;
create table if not exists net.http_request_queue (id bigserial primary key, url text, params jsonb);
create table if not exists net._http_response (
  id bigint primary key, status_code integer, content_type text, headers jsonb, content text,
  timed_out boolean, error_msg text, created timestamptz default now()
);
create or replace function net.http_get(
  url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000
) returns bigint
language sql as $$ insert into net.http_request_queue (url, params) values ($1, $2) returning id $$;

create table if not exists net.http_post_queue (
  id bigint primary key, url text, body jsonb, headers jsonb
);
create or replace function net.http_post(
  url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}',
  timeout_milliseconds integer default 5000
) returns bigint
language plpgsql as $$
declare
  new_id bigint;
begin
  insert into net.http_request_queue (url, params) values (url, params) returning id into new_id;
  insert into net.http_post_queue (id, url, body, headers) values (new_id, url, body, headers);
  return new_id;
end $$;

-- Supabase Vault stand-in (secrets stored in clear here, encrypted in production).
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null) returns uuid
language sql as $$ insert into vault.secrets (name, secret) values (new_name, new_secret) returning id $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null) returns void
language sql as $$ update vault.secrets set secret = new_secret where id = secret_id $$;

-- pg_cron stand-in (the extension itself is not installed locally).
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint
language sql as $$ insert into cron.job (jobname, schedule, command) values ($1, $2, $3) returning jobid $$;
create or replace function cron.unschedule(p_jobid bigint) returns boolean
language sql as $$ delete from cron.job where jobid = $1 returning true $$;

-- base schema
create type public.app_role as enum ('owner', 'admin', 'manager', 'dispatcher', 'viewer', 'driver');

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key, org_id uuid references public.organizations (id), role public.app_role not null,
  is_active boolean not null default true, traccar_user_id integer, full_name text,
  last_seen_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.permissions (key text primary key, description text, label_he text, label_en text);
create table public.role_permissions (
  role public.app_role not null, permission text not null references public.permissions (key),
  primary key (role, permission)
);
create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null references public.permissions (key), granted boolean not null,
  primary key (user_id, permission)
);

create or replace function public.current_org_id() returns uuid language sql stable security definer
set search_path to 'public' as $$ select org_id from public.profiles where id = auth.uid() and is_active $$;
create or replace function public.current_role_name() returns text language sql stable security definer
set search_path to 'public' as $$ select role::text from public.profiles where id = auth.uid() and is_active $$;
create or replace function public.has_permission(p_permission text) returns boolean language sql stable
security definer set search_path to 'public' as $$ select false $$;

create table public.audit_log (
  id bigserial primary key, org_id uuid, user_id uuid, action text, table_name text, row_id text,
  old_data jsonb, new_data jsonb, created_at timestamptz default now()
);
create or replace function public.audit_row() returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (org_id, user_id, action, table_name, row_id, old_data, new_data)
  values ((rec->>'org_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, rec->>'id',
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations (id),
  traccar_device_id integer not null, name text, plate_number text, vin text, make text, model text,
  model_year integer, status text, notes text, created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.drivers (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations (id),
  traccar_driver_id integer, profile_id uuid references public.profiles (id), full_name text,
  national_id text, phone text, email text, license_number text, license_class text, license_expiry date,
  status text, notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.vehicle_driver_assignments (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations (id),
  vehicle_id uuid not null references public.vehicles (id), driver_id uuid not null references public.drivers (id),
  starts_at timestamptz not null default now(), ends_at timestamptz
);
create table public.document_types (key text primary key, label_he text, label_en text, applies_to text);
create table public.documents (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations (id),
  vehicle_id uuid references public.vehicles (id), driver_id uuid references public.drivers (id),
  document_type text references public.document_types (key), title text, issued_at date,
  expires_at date, storage_path text, file_name text, notes text, created_by uuid, created_at timestamptz default now()
);

alter table public.vehicles enable row level security;
alter table public.vehicle_driver_assignments enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create view public.documents_expiring with (security_invoker = true) as
select d.id, d.org_id, d.vehicle_id, d.driver_id,
       case when d.vehicle_id is not null then 'vehicle'
            when d.driver_id is not null then 'driver' else 'organization' end as entity,
       d.document_type, t.label_he, t.label_en, d.title, d.expires_at,
       (d.expires_at - current_date) as days_left,
       case when d.expires_at < current_date then 'expired'
            when d.expires_at - current_date <= 30 then 'expiring' else 'valid' end as expiry_status,
       v.plate_number, v.traccar_device_id, dr.full_name as driver_name, dr.traccar_driver_id
  from public.documents d
  join public.document_types t on t.key = d.document_type
  left join public.vehicles v on v.id = d.vehicle_id
  left join public.drivers dr on dr.id = d.driver_id
 where d.expires_at is not null;
create view public.current_assignments with (security_invoker = true) as
select * from public.vehicle_driver_assignments
 where starts_at <= now() and (ends_at is null or ends_at > now());

insert into public.permissions (key) values
  ('users.read'), ('users.manage'), ('vehicles.read'), ('vehicles.write'), ('drivers.read'),
  ('drivers.write'), ('assignments.write'), ('documents.read'), ('documents.write'),
  ('reports.read'), ('audit.read');
insert into public.role_permissions (role, permission)
select r.role::public.app_role, p.key from public.permissions p
cross join (values ('admin'), ('manager')) r(role);
insert into public.role_permissions (role, permission)
select 'viewer', key from public.permissions where key like '%.read';
