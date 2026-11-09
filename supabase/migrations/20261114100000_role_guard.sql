-- viper fleet: roles and permission overrides are guarded in the database (SEC-08). Idempotent.
--
-- The rules lived only in the interface ("you cannot edit yourself", "only an owner touches an
-- owner"), while the browser writes profiles.role and user_permissions directly. Whatever the row
-- policies on the server say, these triggers now refuse, for a signed-in user:
--
--   profiles          changing your own role, organization or access; moving anyone to another
--                     organization; touching a profile of another organization; making or
--                     unmaking an owner unless you are an owner; any role or access change
--                     without users.manage
--   user_permissions  overrides for yourself, for another organization, or for an owner unless
--                     you are an owner; platform keys (customers.*, billing.*); anything without
--                     users.manage
--
-- Platform administrators and server-side code (the service role, migrations: no auth.uid())
-- are not limited. Every role, organization or access change, and every override, is written
-- to audit_log.

begin;

-- The signed-in user's own profile; empty for the service role.
create or replace function public.role_guard_actor()
returns table (id uuid, org_id uuid, role public.app_role)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.org_id, p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

revoke all on function public.role_guard_actor() from public, anon;

create or replace function public.guard_profile_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor record;
  target public.profiles := coalesce(new, old);
begin
  if auth.uid() is null or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  select * into actor from public.role_guard_actor();
  if actor.id is null then
    raise exception 'no active profile' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Name, last seen and the like: anyone the row policies allow. The rest is guarded.
    if new.role is not distinct from old.role
       and new.org_id is not distinct from old.org_id
       and new.is_active is not distinct from old.is_active then
      return new;
    end if;
    if old.id = actor.id then
      raise exception 'you cannot change your own role, organization or access'
        using errcode = '42501';
    end if;
    if new.org_id is distinct from old.org_id then
      raise exception 'users cannot be moved to another organization' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' and old.id = actor.id then
    raise exception 'you cannot remove yourself' using errcode = '42501';
  end if;

  if target.org_id is distinct from actor.org_id then
    raise exception 'that user is in another organization' using errcode = '42501';
  end if;
  if (coalesce(new.role::text, '') = 'owner' or coalesce(old.role::text, '') = 'owner')
     and actor.role <> 'owner' then
    raise exception 'only an owner can make, change or remove an owner' using errcode = '42501';
  end if;
  if not public.has_permission('users.manage') then
    raise exception 'users.manage is required' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before insert or update or delete on public.profiles
  for each row execute function public.guard_profile_change();

-- Role, organization and access changes go to the audit log (not every "last seen").
create or replace function public.audit_profile_access()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and new.role is not distinct from old.role
     and new.org_id is not distinct from old.org_id
     and new.is_active is not distinct from old.is_active then
    return null;
  end if;
  insert into public.audit_log (org_id, user_id, action, table_name, row_id, old_data, new_data)
  values (coalesce(new.org_id, old.org_id), auth.uid(), lower(tg_op), 'profiles',
          coalesce(new.id, old.id)::text,
          case when tg_op <> 'INSERT'
               then jsonb_build_object('role', old.role, 'org_id', old.org_id, 'is_active', old.is_active) end,
          case when tg_op <> 'DELETE'
               then jsonb_build_object('role', new.role, 'org_id', new.org_id, 'is_active', new.is_active) end);
  return null;
end;
$$;

drop trigger if exists profiles_access_audit on public.profiles;
create trigger profiles_access_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_profile_access();

create or replace function public.guard_user_permission()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor record;
  target public.profiles;
  rec public.user_permissions := coalesce(new, old);
begin
  if auth.uid() is null or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  select * into actor from public.role_guard_actor();
  select * into target from public.profiles where id = rec.user_id;
  if actor.id is null then
    raise exception 'no active profile' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'an override cannot move to another user' using errcode = '42501';
  end if;
  if rec.user_id = actor.id then
    raise exception 'you cannot change your own permissions' using errcode = '42501';
  end if;
  if target.id is null or target.org_id is distinct from actor.org_id then
    raise exception 'that user is in another organization' using errcode = '42501';
  end if;
  if target.role = 'owner' and actor.role <> 'owner' then
    raise exception 'only an owner can change an owner''s permissions' using errcode = '42501';
  end if;
  if rec.permission like 'customers.%' or rec.permission like 'billing.%' then
    raise exception 'platform permissions are not granted per user' using errcode = '42501';
  end if;
  if not public.has_permission('users.manage') then
    raise exception 'users.manage is required' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists user_permissions_guard on public.user_permissions;
create trigger user_permissions_guard before insert or update or delete on public.user_permissions
  for each row execute function public.guard_user_permission();

create or replace function public.audit_user_permission()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec public.user_permissions := coalesce(new, old);
begin
  insert into public.audit_log (org_id, user_id, action, table_name, row_id, old_data, new_data)
  values ((select org_id from public.profiles where id = rec.user_id), auth.uid(), lower(tg_op),
          'user_permissions', rec.user_id || ':' || rec.permission,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end;
$$;

drop trigger if exists user_permissions_audit on public.user_permissions;
create trigger user_permissions_audit after insert or update or delete on public.user_permissions
  for each row execute function public.audit_user_permission();

commit;
