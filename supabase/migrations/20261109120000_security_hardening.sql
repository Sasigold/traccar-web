-- viper fleet: security hardening (review items SEC-01, SEC-04 and the dispatch file rule).
-- Idempotent.
--
-- 1. Customers, device registry and billing are platform data (no org_id). Until now every
--    organization's owner and admin held customers.* / billing.* and could read or change all
--    customers and bills through the REST API. These keys now belong to platform administrators
--    only (public.platform_admins), whatever the organization role or overrides say.
-- 2. Drivers could read and change child rows of every incident and inspection in their
--    organization (parties with national IDs, insurance claims, photos, checklist answers).
--    Child rows now follow their parent row for drivers.
-- 3. Files: dispatch files ignored the read/write distinction (viewers could overwrite or delete
--    proof of delivery), and drivers could delete incident and inspection evidence.

begin;

-- ─── 1. platform administrators ─────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles (id) on delete set null
);

comment on table public.platform_admins is
  'Users who run the service (super admin area): customers, device registry, billing.';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.platform_admins pa
      join public.profiles pr on pr.id = pa.user_id
     where pa.user_id = auth.uid() and pr.is_active
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (public.is_platform_admin() or user_id = auth.uid());

drop policy if exists platform_admins_insert on public.platform_admins;
create policy platform_admins_insert on public.platform_admins for insert to authenticated
  with check (public.is_platform_admin());

-- Nobody removes themselves, so the service always keeps at least one administrator.
drop policy if exists platform_admins_delete on public.platform_admins;
create policy platform_admins_delete on public.platform_admins for delete to authenticated
  using (public.is_platform_admin() and user_id <> auth.uid());

grant select, insert, delete on public.platform_admins to authenticated;

-- Seed: the active owners and admins who are not users of a customer (the people who run the
-- service). If that finds nobody, every active owner keeps access as before. Does nothing once
-- the table has rows; callable again by the service role only.
create or replace function public.seed_platform_admins()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  added integer := 0;
begin
  if exists (select 1 from public.platform_admins) then
    return 0;
  end if;
  insert into public.platform_admins (user_id)
  select pr.id
    from public.profiles pr
   where pr.role::text in ('owner', 'admin')
     and pr.is_active
     and not exists (
       select 1 from public.customer_users cu where cu.traccar_user_id = pr.traccar_user_id
     )
  on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    insert into public.platform_admins (user_id)
    select pr.id from public.profiles pr where pr.role::text = 'owner' and pr.is_active
    on conflict do nothing;
    get diagnostics added = row_count;
  end if;
  return added;
end;
$$;

revoke all on function public.seed_platform_admins() from public, anon, authenticated;

select public.seed_platform_admins();

-- Same order as before (own override, owner, organization role, global default), except that
-- the platform keys answer only to platform_admins.
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
  select case
    when p_permission like 'customers.%' or p_permission like 'billing.%'
      then public.is_platform_admin()
    else coalesce(
      (select up.granted from public.user_permissions up join me on me.id = up.user_id
        where up.permission = p_permission),
      (select true from me where me.role = 'owner'),
      (select orp.granted from public.org_role_permissions orp join me
          on me.org_id = orp.org_id and me.role = orp.role
        where orp.permission = p_permission),
      exists (select 1 from public.role_permissions rp join me on me.role = rp.role
               where rp.permission = p_permission),
      false
    )
  end;
$$;

-- ─── 2. child rows follow their parent for drivers ──────────────────────────

-- The parent subquery runs under the parent's own row level security, so a driver only reaches
-- the children of the incidents and inspections they may see (their own).
do $$
declare
  spec text[];
  specs text[][] := array[
    ['inspection_items', 'inspections.read', 'inspections.write', 'inspection_id', 'inspections'],
    ['incident_photos', 'incidents.read', 'incidents.write', 'incident_id', 'incidents'],
    ['incident_parties', 'incidents.read', 'incidents.write', 'incident_id', 'incidents'],
    ['insurance_claims', 'incidents.read', 'incidents.write', 'incident_id', 'incidents']
  ];
  scope text;
begin
  foreach spec slice 1 in array specs loop
    scope := format('(not public.is_driver_role() or %I in (select id from public.%I))', spec[4], spec[5]);
    execute format('drop policy if exists %I on public.%I', spec[1] || '_select', spec[1]);
    execute format(
      'create policy %I on public.%I for select using (org_id = public.current_org_id() '
      || 'and (public.has_permission(%L) or public.has_permission(%L)) and %s)',
      spec[1] || '_select', spec[1], spec[2], spec[3], scope);
    execute format('drop policy if exists %I on public.%I', spec[1] || '_write', spec[1]);
    execute format(
      'create policy %I on public.%I for all using (org_id = public.current_org_id() '
      || 'and public.has_permission(%L) and %s) with check (org_id = public.current_org_id() '
      || 'and public.has_permission(%L) and %s)',
      spec[1] || '_write', spec[1], spec[3], scope, spec[3], scope);
  end loop;
end;
$$;

-- ─── 3. files ───────────────────────────────────────────────────────────────

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
           -- Drivers upload proof of delivery for their own jobs with dispatch.read.
           when 'dispatch' then case
             when p_write then public.has_permission('dispatch.write')
                            or (public.is_driver_role() and public.has_permission('dispatch.read'))
             else public.has_permission('dispatch.read') or public.has_permission('dispatch.write')
           end
           else false
         end;
$$;

-- Evidence stays: drivers add files but never replace or delete them.
drop policy if exists fleet_files_update on storage.objects;
create policy fleet_files_update on storage.objects for update
  using (bucket_id = 'fleet-files' and public.fleet_file_permission(name, true)
         and not public.is_driver_role());

drop policy if exists fleet_files_delete on storage.objects;
create policy fleet_files_delete on storage.objects for delete
  using (bucket_id = 'fleet-files' and public.fleet_file_permission(name, true)
         and not public.is_driver_role());

commit;
