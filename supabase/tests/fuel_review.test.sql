-- ADM-18: the import mapping is kept per organization and company; costs.write writes it,
-- costs.read reads it, and another organization sees nothing. A reviewed anomaly keeps who.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select case public.current_role_name()
    when 'owner' then p_permission in ('costs.read', 'costs.write')
    when 'viewer' then p_permission = 'costs.read'
    else false end
$$;

insert into public.organizations (id, name) values
  ('fa000000-0000-0000-0000-000000000000', 'Fuel A'),
  ('fb000000-0000-0000-0000-000000000000', 'Fuel B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000fa001', 'fa000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000fa002', 'fa000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-0000000fb001', 'fb000000-0000-0000-0000-000000000000', 'owner');

select pg_temp.as_user('00000000-0000-0000-0000-0000000fa001');
insert into public.fuel_import_profiles (org_id, provider, mapping)
values ('fa000000-0000-0000-0000-000000000000', 'delek', '{"total": "סכום"}')
on conflict (org_id, provider) do update set mapping = excluded.mapping;
insert into public.fuel_import_profiles (org_id, provider, mapping)
values ('fa000000-0000-0000-0000-000000000000', 'delek', '{"total": "סה\"כ"}')
on conflict (org_id, provider) do update set mapping = excluded.mapping;
do $$ begin
  assert (select count(*) from public.fuel_import_profiles) = 1, 'one mapping per company';
  assert (select mapping->>'total' from public.fuel_import_profiles) = 'סה"כ', 'the latest wins';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000fa002');
do $$ begin
  assert (select count(*) from public.fuel_import_profiles) = 1, 'costs.read reads it';
  begin
    insert into public.fuel_import_profiles (org_id, provider)
    values ('fa000000-0000-0000-0000-000000000000', 'paz');
    assert false, 'costs.read does not write it';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000fb001');
do $$ begin
  assert (select count(*) from public.fuel_import_profiles) = 0, 'another organization sees nothing';
end $$;

reset role;
do $$ begin
  assert exists (select 1 from information_schema.columns where table_name = 'fuel_transactions'
                  and column_name = 'reviewed_by'), 'a reviewed anomaly keeps who';
end $$;

rollback;
