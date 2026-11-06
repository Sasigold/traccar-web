-- viper fleet roadmap, stage 3: roles per organization, driver scoping, last seen.
-- Idempotent. Changes has_permission(), so every policy picks up the per-organization roles.

begin;

-- 1. Per-organization role permissions on top of the global defaults (role_permissions).
--    A row grants or revokes one permission for one role inside one organization.

insert into public.permissions (key, description) values
  ('roles.manage', 'Change what each role may do in the organization')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission) values ('admin', 'roles.manage')
on conflict do nothing;

create table if not exists public.org_role_permissions (
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  granted boolean not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, role, permission)
);

-- Order: the user's own override, then owner (everything), then the organization's role
-- setting, then the global role default.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select pr.id, pr.org_id, pr.role from public.profiles pr where pr.id = auth.uid() and pr.is_active
  )
  select coalesce(
    (select up.granted from public.user_permissions up join me on me.id = up.user_id
      where up.permission = p_permission),
    (select true from me where me.role = 'owner'),
    (select orp.granted from public.org_role_permissions orp join me
        on me.org_id = orp.org_id and me.role = orp.role
      where orp.permission = p_permission),
    exists (select 1 from public.role_permissions rp join me on me.role = rp.role
             where rp.permission = p_permission),
    false
  );
$$;

alter table public.org_role_permissions enable row level security;

drop policy if exists org_role_permissions_select on public.org_role_permissions;
create policy org_role_permissions_select on public.org_role_permissions for select
  using (org_id = public.current_org_id());

-- Owner stays all-powerful, so nobody edits the owner role; roles.manage can't be taken away
-- from admin here, so an organization can't lock itself out.
drop policy if exists org_role_permissions_manage on public.org_role_permissions;
create policy org_role_permissions_manage on public.org_role_permissions for all
  using (org_id = public.current_org_id() and public.has_permission('roles.manage'))
  with check (org_id = public.current_org_id() and public.has_permission('roles.manage')
              and role <> 'owner'
              and not (role = 'admin' and permission = 'roles.manage' and not granted));

grant select, insert, update, delete on public.org_role_permissions to authenticated;

-- Role changes go to the audit log; row_id is "<role>:<permission>" (the table has no id).
create or replace function public.audit_org_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec public.org_role_permissions := coalesce(new, old);
begin
  insert into public.audit_log (org_id, user_id, action, table_name, row_id, old_data, new_data)
  values (rec.org_id, auth.uid(), lower(tg_op), tg_table_name, rec.role || ':' || rec.permission,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end;
$$;

drop trigger if exists org_role_permissions_audit on public.org_role_permissions;
create trigger org_role_permissions_audit after insert or update or delete on public.org_role_permissions
  for each row execute function public.audit_org_role();

-- 2. Drivers see their own vehicle and their own reports.

create or replace function public.my_driver_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id from public.drivers d where d.profile_id = auth.uid() and d.org_id = public.current_org_id() limit 1;
$$;

-- True for a user whose role is driver; other roles keep their permission-based access.
create or replace function public.is_driver_role()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(public.current_role_name() = 'driver', false);
$$;

create or replace function public.my_vehicle_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.vehicle_id from public.vehicle_driver_assignments a
   where a.driver_id = public.my_driver_id() and (a.ends_at is null or a.ends_at > now())
     and a.starts_at <= now();
$$;

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select
  using (org_id = public.current_org_id() and (
    (not public.is_driver_role() and public.has_permission('vehicles.read'))
    or id in (select public.my_vehicle_ids())));

drop policy if exists vda_select on public.vehicle_driver_assignments;
create policy vda_select on public.vehicle_driver_assignments for select
  using (org_id = public.current_org_id() and (
    (not public.is_driver_role() and public.has_permission('vehicles.read'))
    or driver_id = public.my_driver_id()));

-- Inspections and incidents: a driver reads and writes only their own.
do $$
declare
  spec text[];
  specs text[][] := array[
    ['inspections', 'inspections.read', 'inspections.write',
     '(created_by = auth.uid() or driver_id = public.my_driver_id())'],
    ['incidents', 'incidents.read', 'incidents.write',
     '(reported_by = auth.uid() or driver_id = public.my_driver_id())']
  ];
begin
  foreach spec slice 1 in array specs loop
    execute format('drop policy if exists %I on public.%I', spec[1] || '_select', spec[1]);
    execute format(
      'create policy %I on public.%I for select using (org_id = public.current_org_id() and (public.has_permission(%L) or public.has_permission(%L)) and (not public.is_driver_role() or %s))',
      spec[1] || '_select', spec[1], spec[2], spec[3], spec[4]);
    execute format('drop policy if exists %I on public.%I', spec[1] || '_write', spec[1]);
    execute format(
      'create policy %I on public.%I for all using (org_id = public.current_org_id() and public.has_permission(%L) and (not public.is_driver_role() or %s)) with check (org_id = public.current_org_id() and public.has_permission(%L) and (not public.is_driver_role() or %s))',
      spec[1] || '_write', spec[1], spec[3], spec[4], spec[3], spec[4]);
  end loop;
end $$;

-- Child rows follow their parent for drivers.
drop policy if exists inspection_items_select on public.inspection_items;
create policy inspection_items_select on public.inspection_items for select
  using (org_id = public.current_org_id()
         and (public.has_permission('inspections.read') or public.has_permission('inspections.write'))
         and (not public.is_driver_role() or inspection_id in (select id from public.inspections)));

drop policy if exists incident_photos_select on public.incident_photos;
create policy incident_photos_select on public.incident_photos for select
  using (org_id = public.current_org_id()
         and (public.has_permission('incidents.read') or public.has_permission('incidents.write'))
         and (not public.is_driver_role() or incident_id in (select id from public.incidents)));

-- 3. Last seen, written by the user's own session. Kept out of profiles so the audit log
--    doesn't get a row every few minutes per user.

create table if not exists public.profile_activity (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.profile_activity enable row level security;

drop policy if exists profile_activity_select on public.profile_activity;
create policy profile_activity_select on public.profile_activity for select
  using (profile_id = auth.uid() or (org_id = public.current_org_id() and public.has_permission('users.read')));

grant select on public.profile_activity to authenticated;

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.profile_activity (profile_id, org_id, last_seen_at)
  select pr.id, pr.org_id, now() from public.profiles pr where pr.id = auth.uid() and pr.org_id is not null
  on conflict (profile_id) do update set last_seen_at = excluded.last_seen_at
   where public.profile_activity.last_seen_at < now() - interval '5 minutes';
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
grant execute on function public.my_driver_id() to authenticated;

commit;
