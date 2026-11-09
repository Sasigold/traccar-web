-- viper fleet: employee location privacy (ISR-03, with the database side of SEC-12). Idempotent.
--
-- The Privacy Protection Authority's guidance on employee location: do not track outside working
-- hours (company cars included), say in advance what is collected and why, and get explicit consent.
-- Amendment 13 adds administrative fines; the data security regulations want an access log.
--
--   privacy_policies         per organization: working hours, hide outside them, the driver's
--                            private switch, retention of positions and of the view log
--   privacy_notices          the notice to employees, in versions that are never edited
--   privacy_consents         which driver agreed to which version, and how (portal or paper)
--   privacy_private_periods  the driver's "private" switch, on and off, with who and when
--   privacy_view_log         who looked at which vehicles' locations, for which period
--
-- The app hides locations outside working hours and in private periods (map, replay, reports).
-- Traccar itself still stores every position: deleting old positions is `database.historyDays`
-- in the Traccar server configuration (see FLEET.md).

begin;

insert into public.permissions (key, description) values
  ('privacy.manage', 'Set working hours, the privacy notice and retention; read the view log')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission)
values ('admin'::public.app_role, 'privacy.manage')
on conflict do nothing;

create table if not exists public.privacy_policies (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  hide_outside_hours boolean not null default false,
  -- 0 = Sunday … 6 = Saturday; Sunday to Thursday by default.
  work_days smallint[] not null default '{0,1,2,3,4}',
  work_start time not null default '07:00',
  work_end time not null default '19:00',
  timezone text not null default 'Asia/Jerusalem',
  allow_private_switch boolean not null default true,
  -- How long positions are kept (set in Traccar; recorded here for the notice and the register).
  retention_days integer check (retention_days is null or retention_days between 30 and 3650),
  view_log_days integer not null default 730 check (view_log_days between 365 and 3650),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (work_days <@ '{0,1,2,3,4,5,6}'::smallint[])
);

create table if not exists public.privacy_notices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null check (version > 0),
  body text not null check (length(trim(body)) > 0),
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (org_id, version)
);

create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  notice_version integer not null,
  method text not null default 'portal' check (method in ('portal', 'paper')),
  recorded_by uuid references public.profiles (id) on delete set null,
  consented_at timestamptz not null default now(),
  unique (driver_id, notice_version)
);

create table if not exists public.privacy_private_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  traccar_device_id integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by uuid references public.profiles (id) on delete set null,
  ended_by uuid references public.profiles (id) on delete set null,
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists privacy_private_periods_device_idx
  on public.privacy_private_periods (org_id, traccar_device_id, started_at desc);
create unique index if not exists privacy_private_periods_open_idx
  on public.privacy_private_periods (driver_id) where ended_at is null;

create table if not exists public.privacy_view_log (
  id bigserial primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  traccar_device_ids integer[] not null,
  view text not null check (view in ('replay', 'report', 'live', 'share', 'export')),
  from_time timestamptz,
  to_time timestamptz,
  viewed_at timestamptz not null default now()
);

create index if not exists privacy_view_log_org_idx on public.privacy_view_log (org_id, viewed_at desc);

drop trigger if exists privacy_policies_updated_at on public.privacy_policies;
create trigger privacy_policies_updated_at before update on public.privacy_policies
  for each row execute function public.set_updated_at();

do $$
declare
  name text;
begin
  foreach name in array array['privacy_policies', 'privacy_notices', 'privacy_consents', 'privacy_private_periods'] loop
    execute format('drop trigger if exists %I on public.%I', name || '_audit', name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   name || '_audit', name);
  end loop;
  foreach name in array array['privacy_policies', 'privacy_notices', 'privacy_consents', 'privacy_private_periods', 'privacy_view_log'] loop
    execute format('alter table public.%I enable row level security', name);
  end loop;
end $$;

-- Everyone in the organization reads the policy, the notice and the private periods: the app
-- needs them to hide locations. Only privacy.manage changes them.
drop policy if exists privacy_policies_select on public.privacy_policies;
create policy privacy_policies_select on public.privacy_policies for select
  using (org_id = public.current_org_id());
drop policy if exists privacy_policies_write on public.privacy_policies;
create policy privacy_policies_write on public.privacy_policies for all
  using (org_id = public.current_org_id() and public.has_permission('privacy.manage'))
  with check (org_id = public.current_org_id() and public.has_permission('privacy.manage'));
grant select, insert, update on public.privacy_policies to authenticated;

-- Notices are published, never edited: a new text is a new version.
drop policy if exists privacy_notices_select on public.privacy_notices;
create policy privacy_notices_select on public.privacy_notices for select
  using (org_id = public.current_org_id());
drop policy if exists privacy_notices_insert on public.privacy_notices;
create policy privacy_notices_insert on public.privacy_notices for insert
  with check (org_id = public.current_org_id() and public.has_permission('privacy.manage'));
grant select, insert on public.privacy_notices to authenticated;

-- A driver sees and gives their own consent; privacy.manage sees all and records paper ones.
drop policy if exists privacy_consents_select on public.privacy_consents;
create policy privacy_consents_select on public.privacy_consents for select
  using (org_id = public.current_org_id()
         and (public.has_permission('privacy.manage') or driver_id = public.my_driver_id()));
drop policy if exists privacy_consents_insert on public.privacy_consents;
create policy privacy_consents_insert on public.privacy_consents for insert
  with check (org_id = public.current_org_id() and (
    (method = 'portal' and driver_id = public.my_driver_id())
    or (method = 'paper' and public.has_permission('privacy.manage'))));
grant select, insert on public.privacy_consents to authenticated;

-- Private periods change only through the functions below, so every switch is recorded.
drop policy if exists privacy_private_periods_select on public.privacy_private_periods;
create policy privacy_private_periods_select on public.privacy_private_periods for select
  using (org_id = public.current_org_id());
grant select on public.privacy_private_periods to authenticated;

-- The view log is written by privacy_log_view and read by privacy.manage.
drop policy if exists privacy_view_log_select on public.privacy_view_log;
create policy privacy_view_log_select on public.privacy_view_log for select
  using (org_id = public.current_org_id() and public.has_permission('privacy.manage'));
grant select on public.privacy_view_log to authenticated;

-- The driver turns "private" on for the vehicle assigned to them now (or off again).
create or replace function public.privacy_private_set(p_on boolean)
returns public.privacy_private_periods
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public.my_driver_id();
  v_vehicle public.vehicles;
  v_row public.privacy_private_periods;
begin
  if v_driver is null then
    raise exception 'Only a driver can switch to private' using errcode = '42501';
  end if;
  if p_on then
    if not coalesce((select allow_private_switch from public.privacy_policies
                      where org_id = public.current_org_id()), true) then
      raise exception 'The organization does not allow the private switch' using errcode = '42501';
    end if;
    select * into v_row from public.privacy_private_periods
     where driver_id = v_driver and ended_at is null;
    if found then
      return v_row;
    end if;
    select v.* into v_vehicle from public.vehicles v
     where v.id in (select public.my_vehicle_ids()) limit 1;
    insert into public.privacy_private_periods (org_id, driver_id, vehicle_id, traccar_device_id, started_by)
    values (public.current_org_id(), v_driver, v_vehicle.id, v_vehicle.traccar_device_id, auth.uid())
    returning * into v_row;
  else
    update public.privacy_private_periods
       set ended_at = now(), ended_by = auth.uid()
     where driver_id = v_driver and ended_at is null
    returning * into v_row;
  end if;
  return v_row;
end $$;

-- A manager ends a private period someone forgot to turn off; recorded with their name.
create or replace function public.privacy_private_end(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_permission('privacy.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.privacy_private_periods
     set ended_at = now(), ended_by = auth.uid()
   where id = p_id and org_id = public.current_org_id() and ended_at is null;
end $$;

-- The app records each look at locations: live map selection, replay, reports, exports.
create or replace function public.privacy_log_view(
  p_device_ids integer[], p_view text, p_from timestamptz default null, p_to timestamptz default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.current_org_id() is null or coalesce(cardinality(p_device_ids), 0) = 0 then
    return;
  end if;
  insert into public.privacy_view_log (org_id, profile_id, traccar_device_ids, view, from_time, to_time)
  values (public.current_org_id(), auth.uid(), p_device_ids[1:200], p_view, p_from, p_to);
end $$;

-- Old view log rows go after each organization's period (two years by default).
create or replace function public.privacy_cleanup()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  delete from public.privacy_view_log l
   using public.organizations o
    left join public.privacy_policies p on p.org_id = o.id
   where l.org_id = o.id and l.viewed_at < now() - make_interval(days => coalesce(p.view_log_days, 730));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.privacy_private_set(boolean) from public, anon;
revoke all on function public.privacy_private_end(uuid) from public, anon;
revoke all on function public.privacy_log_view(integer[], text, timestamptz, timestamptz) from public, anon;
revoke all on function public.privacy_cleanup() from public, anon, authenticated;
grant execute on function public.privacy_private_set(boolean) to authenticated;
grant execute on function public.privacy_private_end(uuid) to authenticated;
grant execute on function public.privacy_log_view(integer[], text, timestamptz, timestamptz) to authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'vf_privacy_cleanup';
  perform cron.schedule('vf_privacy_cleanup', '20 3 * * *', 'select public.privacy_cleanup();');
end $$;

commit;
