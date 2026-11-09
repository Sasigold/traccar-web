-- Roles and permission overrides are guarded in the database (SEC-08), whatever the interface or
-- the row policies allow.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- The guard is about the triggers, not the row policies: let the test users reach the rows.
grant select, insert, update, delete on public.profiles, public.user_permissions to authenticated;
alter table public.profiles disable row level security;
alter table public.user_permissions disable row level security;

insert into public.organizations (id, name) values
  ('a4000000-0000-0000-0000-000000000000', 'Guard A'),
  ('b4000000-0000-0000-0000-000000000000', 'Guard B');
insert into public.profiles (id, org_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000004a1', 'a4000000-0000-0000-0000-000000000000', 'owner', 'Owner A'),
  ('00000000-0000-0000-0000-0000000004a2', 'a4000000-0000-0000-0000-000000000000', 'admin', 'Admin A'),
  ('00000000-0000-0000-0000-0000000004a3', 'a4000000-0000-0000-0000-000000000000', 'viewer', 'Viewer A'),
  ('00000000-0000-0000-0000-0000000004a4', 'a4000000-0000-0000-0000-000000000000', 'driver', 'Driver A'),
  ('00000000-0000-0000-0000-0000000004b1', 'b4000000-0000-0000-0000-000000000000', 'viewer', 'Viewer B'),
  ('00000000-0000-0000-0000-0000000004c1', 'b4000000-0000-0000-0000-000000000000', 'viewer', 'Platform');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000004c1');

-- An admin cannot promote themselves, change their organization or switch themselves off.
select pg_temp.as_user('00000000-0000-0000-0000-0000000004a2');
do $$ begin
  begin
    update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000004a2';
    assert false, 'self-promotion is refused';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set org_id = 'b4000000-0000-0000-0000-000000000000'
     where id = '00000000-0000-0000-0000-0000000004a2';
    assert false, 'moving yourself is refused';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000004a2';
    assert false, 'switching yourself off is refused';
  exception when insufficient_privilege then null;
  end;
  -- Your own name is fine.
  update public.profiles set full_name = 'Admin A.' where id = '00000000-0000-0000-0000-0000000004a2';
end $$;

-- An admin manages ordinary users of the own organization, but never an owner, never another
-- organization, and never makes an owner.
do $$ begin
  update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000004a3';
  update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000004a4';
  begin
    update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000004a3';
    assert false, 'an admin cannot make an owner';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004a1';
    assert false, 'an admin cannot demote the owner';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000004a1';
    assert false, 'an admin cannot switch the owner off';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004b1';
    assert false, 'another organization is out of reach';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set org_id = 'a4000000-0000-0000-0000-000000000000'
     where id = '00000000-0000-0000-0000-0000000004b1';
    assert false, 'nobody is moved between organizations';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles where id = '00000000-0000-0000-0000-0000000004a1';
    assert false, 'an admin cannot remove the owner';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A viewer manages nobody.
select pg_temp.as_user('00000000-0000-0000-0000-0000000004b1');
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004c1';
    assert false, 'a viewer cannot change roles';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The owner can make another owner.
select pg_temp.as_user('00000000-0000-0000-0000-0000000004a1');
update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000004a3';
update public.profiles set role = 'viewer' where id = '00000000-0000-0000-0000-0000000004a3';

-- Permission overrides.
select pg_temp.as_user('00000000-0000-0000-0000-0000000004a2');
do $$ begin
  insert into public.user_permissions (user_id, permission, granted)
  values ('00000000-0000-0000-0000-0000000004a3', 'vehicles.write', true);
  begin
    insert into public.user_permissions (user_id, permission, granted)
    values ('00000000-0000-0000-0000-0000000004a2', 'users.manage', true);
    assert false, 'no overrides for yourself';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_permissions (user_id, permission, granted)
    values ('00000000-0000-0000-0000-0000000004b1', 'vehicles.read', true);
    assert false, 'no overrides in another organization';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_permissions (user_id, permission, granted)
    values ('00000000-0000-0000-0000-0000000004a1', 'vehicles.read', false);
    assert false, 'an admin cannot restrict the owner';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.user_permissions set user_id = '00000000-0000-0000-0000-0000000004a2'
     where user_id = '00000000-0000-0000-0000-0000000004a3';
    assert false, 'an override cannot be moved to yourself';
  exception when insufficient_privilege then null;
  end;
  delete from public.user_permissions where user_id = '00000000-0000-0000-0000-0000000004a3';
end $$;

-- A platform administrator is not limited.
select pg_temp.as_user('00000000-0000-0000-0000-0000000004c1');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004b1';

-- Server-side code (no signed-in user) is not limited either.
select pg_temp.as_admin();
update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000004a2';

-- Everything that changed access is in the audit log, with who did it.
do $$ begin
  assert (select count(*) from public.audit_log
           where table_name = 'profiles' and action = 'update'
             and row_id = '00000000-0000-0000-0000-0000000004a3') = 3,
    'role changes are audited';
  assert exists (select 1 from public.audit_log
                  where table_name = 'profiles' and action = 'insert'
                    and row_id = '00000000-0000-0000-0000-0000000004a3'),
    'new users are audited';
  assert exists (select 1 from public.audit_log
                  where table_name = 'profiles' and row_id = '00000000-0000-0000-0000-0000000004a4'
                    and user_id = '00000000-0000-0000-0000-0000000004a2'
                    and new_data->>'is_active' = 'false'),
    'switching a user off is audited with the actor';
  assert not exists (select 1 from public.audit_log
                      where table_name = 'profiles' and row_id = '00000000-0000-0000-0000-0000000004a2'
                        and user_id = '00000000-0000-0000-0000-0000000004a2'),
    'a name change is not an access change';
  assert (select count(*) from public.audit_log where table_name = 'user_permissions'
           and row_id like '00000000-0000-0000-0000-0000000004a3:%') = 2,
    'overrides are audited';
end $$;

rollback;
\echo 'role_guard.test.sql: all assertions passed'
