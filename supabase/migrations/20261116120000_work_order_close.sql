-- viper fleet: closing a work order (ADM-19). Idempotent.
--
-- work_orders.prices_include_vat: whether the line prices already include VAT, so the order
-- shows the subtotal, the VAT and the total the right way round (default: they do, as garage
-- invoices are quoted).
-- When an order is closed (status becomes 'done'), the faults it was opened for (issues with
-- its work_order_id that are still open) are resolved with it, in the same transaction.

begin;

alter table public.work_orders
  add column if not exists prices_include_vat boolean not null default true;

create or replace function public.work_order_resolve_issues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    update public.issues
       set status = 'resolved', resolved_at = coalesce(new.closed_at, now()), updated_at = now()
     where work_order_id = new.id
       and org_id = new.org_id
       and status in ('open', 'in_progress');
  end if;
  return new;
end;
$$;

revoke all on function public.work_order_resolve_issues() from public, anon, authenticated;

-- The stored total is what the order costs: with prices before VAT, the lines' sum plus VAT
-- (18%, as the form shows it). It follows the lines and the flag, so costs and reports read the
-- same total as the order.
create or replace function public.work_order_recompute(p_order uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.work_orders o
     set total_cost = round(
           coalesce((select sum(i.total) from public.work_order_items i where i.work_order_id = o.id), 0)
           * case when o.prices_include_vat then 1 else 1.18 end,
           2)
   where o.id = p_order;
$$;

revoke all on function public.work_order_recompute(uuid) from public, anon, authenticated;

create or replace function public.work_order_total()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.work_order_recompute(coalesce(new.work_order_id, old.work_order_id));
  if tg_op = 'UPDATE' and old.work_order_id is distinct from new.work_order_id then
    perform public.work_order_recompute(old.work_order_id);
  end if;
  return null;
end;
$$;

create or replace function public.work_order_vat_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.work_order_recompute(new.id);
  return null;
end;
$$;

revoke all on function public.work_order_vat_changed() from public, anon, authenticated;

drop trigger if exists work_order_vat_changed on public.work_orders;
create trigger work_order_vat_changed after update of prices_include_vat on public.work_orders
  for each row when (old.prices_include_vat is distinct from new.prices_include_vat)
  execute function public.work_order_vat_changed();

drop trigger if exists work_order_resolve_issues on public.work_orders;
create trigger work_order_resolve_issues after update of status on public.work_orders
  for each row execute function public.work_order_resolve_issues();

commit;
