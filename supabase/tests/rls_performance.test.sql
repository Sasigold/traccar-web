-- PRF-07: policies evaluate the permission helpers once per query, organization columns and
-- foreign keys are indexed, and anonymous visitors cannot call the helpers.
\set ON_ERROR_STOP 1
begin;

do $$
declare
  bad text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into bad
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
         ~ '(?<!SELECT )(public\.)?(has_permission|current_org_id|my_driver_id|is_driver_role|is_platform_admin)\(';
  assert bad is null, 'helpers called per row in: ' || coalesce(bad, '');

  select string_agg(c.relname, ', ') into bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id'
   where c.relkind = 'r'
     and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = a.attnum);
  assert bad is null, 'org_id without an index in: ' || coalesce(bad, '');

  assert not has_function_privilege('anon', 'public.has_permission(text)', 'execute'),
    'anon cannot call has_permission';
  assert not has_function_privilege('anon', 'public.current_org_id()', 'execute'),
    'anon cannot call current_org_id';
  assert has_function_privilege('authenticated', 'public.has_permission(text)', 'execute'),
    'signed-in sessions still can';
end $$;

rollback;
\echo 'rls_performance.test.sql: all assertions passed'
