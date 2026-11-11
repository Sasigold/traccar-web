-- viper fleet: agreed supplier prices, to check invoices against (ISR-13). Idempotent.
--
-- A price list line: what (a description, matched loosely to invoice lines), for which supplier
-- (or any), its kind (labor, part, fee), the agreed unit price, how far above it is still fine
-- (tolerance_pct), and when it is valid. The check itself runs in the app
-- (src/common/fleet/invoiceCheck.js) on a work order's lines: above the agreement, the same line
-- twice, an invoice number billed before, lines with no agreed price.
-- Who: maintenance.read reads, maintenance.write writes (as for work orders).

begin;

create table if not exists public.vendor_prices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete cascade,
  description text not null check (length(trim(description)) between 2 and 200),
  kind text check (kind is null or kind in ('labor', 'part', 'fee')),
  unit_price numeric not null check (unit_price >= 0),
  tolerance_pct numeric not null default 5 check (tolerance_pct >= 0 and tolerance_pct <= 100),
  valid_from date,
  valid_to date,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index if not exists vendor_prices_org_idx on public.vendor_prices (org_id);
create index if not exists vendor_prices_vendor_idx on public.vendor_prices (vendor_id);

-- A supplier of the caller's organization (or none, for any supplier).
create or replace function public.vendor_in_my_org(p_vendor uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_vendor is null
      or exists (select 1 from public.vendors where id = p_vendor and org_id = public.current_org_id())
$$;

revoke all on function public.vendor_in_my_org(uuid) from public, anon;
grant execute on function public.vendor_in_my_org(uuid) to authenticated;

alter table public.vendor_prices enable row level security;

drop policy if exists vendor_prices_select on public.vendor_prices;
create policy vendor_prices_select on public.vendor_prices for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('maintenance.read')));
drop policy if exists vendor_prices_write on public.vendor_prices;
create policy vendor_prices_write on public.vendor_prices for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('maintenance.write')))
  with check (org_id = (select public.current_org_id())
              and (select public.has_permission('maintenance.write'))
              and public.vendor_in_my_org(vendor_id));

grant select, insert, update, delete on public.vendor_prices to authenticated;

drop trigger if exists vendor_prices_updated_at on public.vendor_prices;
create trigger vendor_prices_updated_at before update on public.vendor_prices
  for each row execute function public.set_updated_at();
drop trigger if exists vendor_prices_audit on public.vendor_prices;
create trigger vendor_prices_audit after insert or update or delete on public.vendor_prices
  for each row execute function public.audit_row();

commit;
