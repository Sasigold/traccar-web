-- viper fleet: saves that span several tables happen in one transaction (ARC-05). Idempotent.
--
-- The browser used to write a parent row, then delete its child rows and insert them again in
-- separate requests: a dropped connection in between left a work order without lines, an
-- incident without its parties, a checklist without items. Now one call does it all, or nothing:
--
--   fleet_save(kind, id, row, children, single)
--     kind      'work_order'           work_orders, lines in work_order_items
--               'incident'             incidents, parties in incident_parties, the claim in
--                                      insurance_claims (single)
--               'inspection_template'  inspection_templates, items in inspection_template_items
--     id        null to insert, else the row to update
--     row       the parent's columns (only real, writable columns are used)
--     children  null keeps them; else the full list, replacing the old ones (org_id, the parent
--               link and sort_order are filled in)
--     single    the incident's claim: inserted, or updated by its id; null leaves it
--
-- Runs with the caller's rights: row security decides, as for the direct writes. (Bills have
-- their own function, billing_save_invoice, SEC-09.)

begin;

-- The columns of a table that a save may write: real, not generated, not the id.
create or replace function public.fleet_save_columns(p_table text, p_row jsonb)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(c.column_name::text order by c.ordinal_position), '{}')
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table
     and c.is_generated = 'NEVER' and c.column_name <> 'id'
     and p_row ? c.column_name
$$;

create or replace function public.fleet_save_insert(p_table text, p_row jsonb)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_columns text[] := public.fleet_save_columns(p_table, p_row);
  v_list text;
  v_id uuid;
begin
  if p_table not in ('work_orders', 'work_order_items', 'incidents', 'incident_parties',
                     'insurance_claims', 'inspection_templates', 'inspection_template_items') then
    raise exception 'not a table fleet_save writes' using errcode = '42501';
  end if;
  select string_agg(quote_ident(c), ', ') into v_list from unnest(v_columns) c;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning id',
                 p_table, v_list, v_list, p_table)
    into v_id using p_row;
  return v_id;
end;
$$;

create or replace function public.fleet_save_update(p_table text, p_id uuid, p_row jsonb)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_columns text[] := public.fleet_save_columns(p_table, p_row);
  v_list text;
  v_found boolean;
begin
  if p_table not in ('work_orders', 'work_order_items', 'incidents', 'incident_parties',
                     'insurance_claims', 'inspection_templates', 'inspection_template_items') then
    raise exception 'not a table fleet_save writes' using errcode = '42501';
  end if;
  if cardinality(v_columns) = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into v_found using p_id;
  else
    select string_agg(quote_ident(c), ', ') into v_list from unnest(v_columns) c;
    execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where t.id = $2',
                   p_table, v_list, v_list, p_table)
      using p_row, p_id;
    get diagnostics v_found = row_count;
  end if;
  if not v_found then
    raise exception 'no such row, or no permission to change it' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.fleet_save(
  p_kind text,
  p_id uuid,
  p_row jsonb,
  p_children jsonb default null,
  p_single jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_parent text;
  v_child text;
  v_link text;
  v_single text;
  v_id uuid := p_id;
  v_org uuid;
  v_child_row jsonb;
  v_index integer := 0;
begin
  case p_kind
    when 'work_order' then
      v_parent := 'work_orders'; v_child := 'work_order_items'; v_link := 'work_order_id';
    when 'incident' then
      v_parent := 'incidents'; v_child := 'incident_parties'; v_link := 'incident_id';
      v_single := 'insurance_claims';
    when 'inspection_template' then
      v_parent := 'inspection_templates'; v_child := 'inspection_template_items';
      v_link := 'template_id';
    else
      raise exception 'unknown kind %', p_kind using errcode = '22023';
  end case;

  if v_id is null then
    v_id := public.fleet_save_insert(v_parent, p_row);
  else
    perform public.fleet_save_update(v_parent, v_id, p_row);
  end if;
  execute format('select org_id from public.%I where id = $1', v_parent) into v_org using v_id;

  if p_children is not null then
    execute format('delete from public.%I where %I = $1', v_child, v_link) using v_id;
    for v_child_row in select value from jsonb_array_elements(p_children) loop
      v_child_row := (v_child_row - 'id')
        || jsonb_build_object('org_id', v_org, v_link, v_id)
        || case when exists (select 1 from information_schema.columns
                              where table_schema = 'public' and table_name = v_child
                                and column_name = 'sort_order')
                then jsonb_build_object('sort_order', v_index) else '{}'::jsonb end;
      perform public.fleet_save_insert(v_child, v_child_row);
      v_index := v_index + 1;
    end loop;
  end if;

  if p_single is not null and v_single is not null then
    if nullif(p_single->>'id', '') is null then
      perform public.fleet_save_insert(v_single,
        (p_single - 'id') || jsonb_build_object('org_id', v_org, v_link, v_id));
    else
      perform public.fleet_save_update(v_single, (p_single->>'id')::uuid, p_single - 'id' - v_link - 'org_id');
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.fleet_save_columns(text, jsonb) from public, anon;
revoke all on function public.fleet_save_insert(text, jsonb) from public, anon;
revoke all on function public.fleet_save_update(text, uuid, jsonb) from public, anon;
revoke all on function public.fleet_save(text, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.fleet_save_columns(text, jsonb) to authenticated;
grant execute on function public.fleet_save_insert(text, jsonb) to authenticated;
grant execute on function public.fleet_save_update(text, uuid, jsonb) to authenticated;
grant execute on function public.fleet_save(text, uuid, jsonb, jsonb, jsonb) to authenticated;

commit;
