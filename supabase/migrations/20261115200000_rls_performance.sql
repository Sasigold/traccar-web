-- viper fleet: faster row security (PRF-07). Idempotent.
--
-- 1. Policies call the permission helpers (has_permission, current_org_id, my_driver_id,
--    is_driver_role, is_platform_admin) as `(select ...)`, so Postgres evaluates each once per
--    query (an init plan) instead of once per row. Every existing policy of the public schema is
--    rewritten in place; a call already inside a `select` is left alone, so running this again
--    changes nothing. New policies should use the same form.
-- 2. Every table with an org_id gets an index on it, and every single-column foreign key an
--    index on its column, when it has none whose first column it is.
-- 3. The helpers are not callable by anonymous visitors.

begin;

do $$
declare
  policy record;
  helpers constant text :=
    '(?<!SELECT )(?:public\.)?(current_org_id|my_driver_id|is_driver_role|is_platform_admin)\(\)';
  permission constant text := '(?<!SELECT )(?:public\.)?has_permission\(([^()]*)\)';
  using_expr text;
  check_expr text;
  sql text;
begin
  for policy in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
  loop
    using_expr := policy.qual;
    check_expr := policy.with_check;
    if using_expr is not null then
      using_expr := regexp_replace(using_expr, helpers, '(SELECT public.\1())', 'g');
      using_expr := regexp_replace(using_expr, permission, '(SELECT public.has_permission(\1))', 'g');
    end if;
    if check_expr is not null then
      check_expr := regexp_replace(check_expr, helpers, '(SELECT public.\1())', 'g');
      check_expr := regexp_replace(check_expr, permission, '(SELECT public.has_permission(\1))', 'g');
    end if;
    if using_expr is distinct from policy.qual or check_expr is distinct from policy.with_check then
      sql := format('alter policy %I on %I.%I', policy.policyname, policy.schemaname, policy.tablename);
      if using_expr is not null then
        sql := sql || format(' using (%s)', using_expr);
      end if;
      if check_expr is not null then
        sql := sql || format(' with check (%s)', check_expr);
      end if;
      execute sql;
    end if;
  end loop;
end $$;

-- 2. Indexes for the organization filter and for foreign keys.
do $$
declare
  target record;
begin
  for target in
    select c.relname as table_name, a.attname as column_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
     where c.relkind = 'r'
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.oid and i.indkey[0] = a.attnum)
    union
    select c.relname, a.attname
      from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
     where k.contype = 'f'
       and array_length(k.conkey, 1) = 1
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.oid and i.indkey[0] = k.conkey[1])
  loop
    execute format(
      'create index if not exists %I on public.%I (%I)',
      left(target.table_name || '_' || target.column_name || '_idx', 63),
      target.table_name,
      target.column_name
    );
  end loop;
end $$;

-- 3. The helpers belong to signed-in sessions.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.has_permission(text)',
    'public.current_org_id()',
    'public.my_driver_id()',
    'public.is_driver_role()',
    'public.is_platform_admin()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon', fn);
      execute format('grant execute on function %s to authenticated, service_role', fn);
    end if;
  end loop;
end $$;

commit;
