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

drop trigger if exists work_order_resolve_issues on public.work_orders;
create trigger work_order_resolve_issues after update of status on public.work_orders
  for each row execute function public.work_order_resolve_issues();

commit;
