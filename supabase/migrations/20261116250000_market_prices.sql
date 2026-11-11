-- viper fleet: what a garage job usually costs, across fleets (AI-08). Idempotent.
--
-- For a work order's lines: the median unit price of the same line (compared loosely, without
-- case and punctuation) in done work orders of the last 12 months, across the fleets that agreed
-- to the comparison (benchmark_opt_in, AI-09; give to get). Only when at least 5 other fleets
-- have that line; never a fleet's name or its own prices.

begin;

create or replace function public.normalize_item(p_text text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(p_text, '')), '["''״׳`]', '', 'g'),
                             '[^[:alnum:]]+', ' ', 'g'))
$$;

create or replace function public.market_prices(p_descriptions text[], p_min_fleets integer default 5)
returns table (description text, median numeric, fleets integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  me uuid := public.current_org_id();
begin
  if not (public.has_permission('maintenance.read') or public.has_permission('costs.read')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not coalesce((select benchmark_opt_in from public.organizations where id = me), false) then
    return;
  end if;
  return query
    with wanted as (
      select distinct d as description, public.normalize_item(d) as key
        from unnest(coalesce(p_descriptions, '{}')) d
       where length(public.normalize_item(d)) >= 3
       limit 100
    ),
    lines as (
      select public.normalize_item(i.description) as key, i.org_id, i.unit_price
        from public.work_order_items i
        join public.work_orders w on w.id = i.work_order_id and w.status = 'done'
        join public.organizations o on o.id = i.org_id and o.benchmark_opt_in
       where i.org_id <> me
         and coalesce(w.closed_at, w.opened_at) >= now() - interval '12 months'
         and i.unit_price > 0
    )
    select wanted.description,
           round(percentile_cont(0.5) within group (order by l.unit_price)::numeric, 2),
           count(distinct l.org_id)::integer
      from wanted join lines l on l.key = wanted.key
     group by wanted.description
    having count(distinct l.org_id) >= greatest(p_min_fleets, 5);
end;
$$;

revoke all on function public.market_prices(text[], integer) from public, anon;
grant execute on function public.market_prices(text[], integer) to authenticated;

commit;
