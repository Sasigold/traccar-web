-- ARC-11: the shape of the public schema as JSON, for tools/db-types.mjs.
select json_build_object(
  'columns', (
    select coalesce(json_agg(json_build_object(
      'table', c.table_name, 'column', c.column_name, 'type', c.data_type, 'udt', c.udt_name,
      'nullable', c.is_nullable = 'YES',
      'default', c.column_default is not null or c.is_identity = 'YES' or c.is_generated = 'ALWAYS',
      'generated', c.is_generated = 'ALWAYS',
      'kind', t.table_type)
      order by c.table_name, c.ordinal_position), '[]')
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'),
  'enums', (
    select coalesce(json_object_agg(name, labels), '{}')
      from (select t.typname as name, json_agg(e.enumlabel order by e.enumsortorder) as labels
              from pg_type t join pg_enum e on e.enumtypid = t.oid
              join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' group by t.typname) enums),
  'functions', (
    select coalesce(json_agg(json_build_object(
      'name', p.proname,
      'args', coalesce((select json_agg(json_build_object('name', a.name, 'type', a.type,
                                                          'optional', a.ord > p.pronargs - p.pronargdefaults)
                                        order by a.ord)
                          from unnest(p.proargnames[1:p.pronargs],
                                      (string_to_array(nullif(oidvectortypes(p.proargtypes), ''), ', '))::text[])
                               with ordinality as a(name, type, ord)), '[]'),
      'returns', format_type(p.prorettype, null),
      'set', p.proretset)
      order by p.proname, oidvectortypes(p.proargtypes)), '[]')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and p.prorettype <> 'trigger'::regtype)
);
