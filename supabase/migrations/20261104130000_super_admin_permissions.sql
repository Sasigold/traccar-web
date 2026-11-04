-- viper fleet: register the super admin permission keys.
--
-- role_permissions.permission references a permission catalog, so the keys
-- must exist there before roles can get them (20261104120000 only warned).
-- The catalog is found through the foreign key, and NOT NULL columns without
-- a default are filled: label_he / label_en with readable names, any other
-- text column with the key itself.

begin;

do $$
declare
  keys text[] := array['customers.read', 'customers.manage', 'billing.read', 'billing.manage'];
  labels_he text[] := array['צפייה בלקוחות', 'ניהול לקוחות', 'צפייה בחיוב', 'ניהול חיוב'];
  labels_en text[] := array['View customers', 'Manage customers', 'View billing', 'Manage billing'];
  catalog regclass;
  key_column text;
  columns text[];
  exprs text[];
  rec record;
  role_name text;
  grants text[][] := array[
    ['owner', 'customers.read'], ['owner', 'customers.manage'],
    ['owner', 'billing.read'], ['owner', 'billing.manage'],
    ['admin', 'customers.read'], ['admin', 'customers.manage'],
    ['admin', 'billing.read'], ['admin', 'billing.manage'],
    ['manager', 'customers.read']
  ];
  i int;
begin
  select c.confrelid::regclass, a.attname
    into catalog, key_column
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.confrelid and a.attnum = c.confkey[1]
  where c.conrelid = 'public.role_permissions'::regclass
    and c.contype = 'f'
    and c.conkey[1] = (
      select attnum from pg_attribute
      where attrelid = 'public.role_permissions'::regclass and attname = 'permission'
    );

  if catalog is not null then
    columns := array[quote_ident(key_column)];
    exprs := array['k.key'];
    for rec in
      select a.attname, format_type(a.atttypid, a.atttypmod) as type
      from pg_attribute a
      where a.attrelid = catalog and a.attnum > 0 and not a.attisdropped
        and a.attname <> key_column
        and (a.attnotnull and not a.atthasdef and a.attidentity = '' and a.attgenerated = ''
             or a.attname in ('label_he', 'label_en'))
    loop
      columns := array_append(columns, quote_ident(rec.attname));
      if rec.attname = 'label_he' then
        exprs := array_append(exprs, 'k.label_he');
      elsif rec.attname = 'label_en' then
        exprs := array_append(exprs, 'k.label_en');
      elsif rec.type in ('text', 'character varying') or rec.type like 'character varying(%' then
        exprs := array_append(exprs, 'k.key');
      else
        raise exception 'super admin: % has required column % (%) that this migration cannot fill',
          catalog, rec.attname, rec.type;
      end if;
    end loop;

    execute format(
      'insert into %s (%s) select %s from unnest($1, $2, $3) as k(key, label_he, label_en) on conflict do nothing',
      catalog, array_to_string(columns, ', '), array_to_string(exprs, ', '))
    using keys, labels_he, labels_en;
    raise notice 'super admin: permission keys registered in %', catalog;
  end if;

  -- One insert per grant, so a role this server does not have is skipped
  -- instead of failing the rest.
  for i in 1 .. array_length(grants, 1) loop
    role_name := grants[i][1];
    begin
      -- Literals, not parameters: role may be an enum, which text does not cast to.
      execute format(
        'insert into public.role_permissions (role, permission) values (%L, %L) on conflict do nothing',
        role_name, grants[i][2]);
    exception
      when invalid_text_representation or foreign_key_violation then
        if role_name = 'manager' then
          raise notice 'super admin: role % not granted (%)', role_name, sqlerrm;
        else
          raise;
        end if;
    end;
  end loop;
end;
$$;

commit;
