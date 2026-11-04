-- viper fleet: super admin area (customers, device registry, billing).
--
-- Builds on the existing Viper Fleet schema (profiles, role_permissions,
-- has_permission). Traccar keeps the users and devices themselves; these
-- tables add what Traccar cannot store: who the customer is, which device
-- belongs to which customer, SIM / installation details, plans, subscriptions
-- and bills. Rows link to Traccar by traccar_user_id / traccar_device_id.
--
-- Apply on the VPS (see FLEET.md):
--   docker exec -i <supabase-db> psql -U postgres -d postgres < 20261104120000_super_admin.sql
--
-- Permission keys added here:
--   customers.read    see customers, the device registry and customer users
--   customers.manage  create / edit customers, assign devices and users
--   billing.read      see plans, subscriptions and bills
--   billing.manage    edit plans and subscriptions, issue bills, record payments

begin;

create extension if not exists pgcrypto;

-- ─── helpers ────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── customers ──────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  company_number text,
  contact_name text,
  email text,
  phone text,
  billing_email text,
  address text,
  status text not null default 'active'
    check (status in ('active', 'trial', 'suspended', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'Customers of the fleet service (super admin area). Devices and Traccar users are linked through device_registry and customer_users.';

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- Traccar users that belong to a customer. One customer per user.
create table if not exists public.customer_users (
  traccar_user_id integer primary key,
  customer_id uuid not null references public.customers (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_users_customer_idx on public.customer_users (customer_id);

-- ─── device registry ────────────────────────────────────────────────────────

-- One row per Traccar device: owner customer, SIM and installation details.
create table if not exists public.device_registry (
  traccar_device_id integer primary key,
  customer_id uuid references public.customers (id) on delete set null,
  device_model text,
  sim_number text,
  sim_provider text,
  iccid text,
  installed_at date,
  installer text,
  billable boolean not null default true,
  notes text,
  assigned_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists device_registry_customer_idx on public.device_registry (customer_id);

drop trigger if exists device_registry_touch on public.device_registry;
create trigger device_registry_touch before update on public.device_registry
  for each row execute function public.touch_updated_at();

-- Every change of owner is kept, so a bill can be explained later.
create table if not exists public.device_assignment_history (
  id bigint generated always as identity primary key,
  traccar_device_id integer not null,
  customer_id uuid references public.customers (id) on delete set null,
  action text not null check (action in ('assigned', 'unassigned')),
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid()
);

create index if not exists device_assignment_history_device_idx
  on public.device_assignment_history (traccar_device_id, changed_at desc);

create or replace function public.device_registry_track_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.customer_id is not null then
      new.assigned_at := coalesce(new.assigned_at, now());
      insert into public.device_assignment_history (traccar_device_id, customer_id, action)
      values (new.traccar_device_id, new.customer_id, 'assigned');
    end if;
  elsif new.customer_id is distinct from old.customer_id then
    if old.customer_id is not null then
      insert into public.device_assignment_history (traccar_device_id, customer_id, action)
      values (old.traccar_device_id, old.customer_id, 'unassigned');
    end if;
    if new.customer_id is not null then
      new.assigned_at := now();
      insert into public.device_assignment_history (traccar_device_id, customer_id, action)
      values (new.traccar_device_id, new.customer_id, 'assigned');
    else
      new.assigned_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists device_registry_owner on public.device_registry;
create trigger device_registry_owner before insert or update on public.device_registry
  for each row execute function public.device_registry_track_owner();

-- ─── billing ────────────────────────────────────────────────────────────────

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  price_per_device numeric(12, 2) not null default 0 check (price_per_device >= 0),
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  setup_fee numeric(12, 2) not null default 0 check (setup_fee >= 0),
  cycle text not null default 'monthly' check (cycle in ('monthly', 'quarterly', 'yearly')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- One subscription per customer. Empty price fields fall back to the plan.
create table if not exists public.billing_subscriptions (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  plan_id uuid references public.billing_plans (id) on delete set null,
  price_per_device numeric(12, 2) check (price_per_device >= 0),
  base_price numeric(12, 2) check (base_price >= 0),
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  cycle text check (cycle in ('monthly', 'quarterly', 'yearly')),
  start_date date not null default current_date,
  next_billing_date date,
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  payment_method text,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  notes text,
  updated_at timestamptz not null default now()
);

drop trigger if exists billing_subscriptions_touch on public.billing_subscriptions;
create trigger billing_subscriptions_touch before update on public.billing_subscriptions
  for each row execute function public.touch_updated_at();

create sequence if not exists public.billing_invoice_number_seq start 1001;

-- A bill (payment request) per customer and period. Not a tax invoice: tax
-- documents still come from the accounting system.
create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.billing_invoice_number_seq'),
  customer_id uuid not null references public.customers (id) on delete restrict,
  issue_date date not null default current_date,
  due_date date not null default (current_date + 30),
  period_start date,
  period_end date,
  subtotal numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 18 check (vat_rate >= 0 and vat_rate <= 100),
  vat_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'cancelled')),
  paid_at date,
  payment_method text,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);

alter sequence public.billing_invoice_number_seq owned by public.billing_invoices.number;

create index if not exists billing_invoices_customer_idx
  on public.billing_invoices (customer_id, issue_date desc);

-- A customer is billed once per period (cancelled bills do not count).
create unique index if not exists billing_invoices_period_once
  on public.billing_invoices (customer_id, period_start)
  where status <> 'cancelled' and period_start is not null;

create table if not exists public.billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  amount numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order integer not null default 0
);

create index if not exists billing_invoice_lines_invoice_idx
  on public.billing_invoice_lines (invoice_id, sort_order);

-- Totals always follow the lines and the VAT rate.
create or replace function public.billing_invoice_totals()
returns trigger
language plpgsql
as $$
declare
  line_sum numeric(12, 2);
begin
  select coalesce(sum(amount), 0) into line_sum
  from public.billing_invoice_lines
  where invoice_id = new.id;
  new.subtotal := line_sum;
  new.vat_amount := round(line_sum * new.vat_rate / 100, 2);
  new.total := new.subtotal + new.vat_amount;
  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := current_date;
  elsif new.status <> 'paid' then
    new.paid_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists billing_invoices_totals on public.billing_invoices;
create trigger billing_invoices_totals before insert or update on public.billing_invoices
  for each row execute function public.billing_invoice_totals();

create or replace function public.billing_invoice_lines_changed()
returns trigger
language plpgsql
as $$
begin
  -- Touching the parent row re-runs billing_invoice_totals.
  update public.billing_invoices
  set updated_at = now()
  where id in (
    select distinct invoice_id
    from (
      select invoice_id from new_rows
      union all
      select invoice_id from old_rows
    ) changed
  );
  return null;
end;
$$;

drop trigger if exists billing_invoice_lines_insert on public.billing_invoice_lines;
drop trigger if exists billing_invoice_lines_update on public.billing_invoice_lines;
drop trigger if exists billing_invoice_lines_delete on public.billing_invoice_lines;

-- Transition tables cannot be shared between event types, so each event gets
-- an empty stand-in for the side it does not have.
create or replace function public.billing_invoice_lines_inserted()
returns trigger
language plpgsql
as $$
begin
  update public.billing_invoices set updated_at = now()
  where id in (select distinct invoice_id from new_rows);
  return null;
end;
$$;

create or replace function public.billing_invoice_lines_deleted()
returns trigger
language plpgsql
as $$
begin
  update public.billing_invoices set updated_at = now()
  where id in (select distinct invoice_id from old_rows);
  return null;
end;
$$;

create trigger billing_invoice_lines_insert after insert on public.billing_invoice_lines
  referencing new table as new_rows
  for each statement execute function public.billing_invoice_lines_inserted();
create trigger billing_invoice_lines_update after update on public.billing_invoice_lines
  referencing new table as new_rows old table as old_rows
  for each statement execute function public.billing_invoice_lines_changed();
create trigger billing_invoice_lines_delete after delete on public.billing_invoice_lines
  referencing old table as old_rows
  for each statement execute function public.billing_invoice_lines_deleted();

-- Bills with the customer name and a computed overdue flag, for the lists.
create or replace view public.billing_invoices_view
with (security_invoker = true)
as
select
  i.*,
  c.name as customer_name,
  (i.status = 'issued' and i.due_date < current_date) as is_overdue
from public.billing_invoices i
join public.customers c on c.id = i.customer_id;

-- Device counts per customer (billable and total), for the lists and billing.
create or replace view public.customer_device_counts
with (security_invoker = true)
as
select
  c.id as customer_id,
  count(r.traccar_device_id) as devices,
  count(r.traccar_device_id) filter (where r.billable) as billable_devices
from public.customers c
left join public.device_registry r on r.customer_id = c.id
group by c.id;

-- ─── row level security ─────────────────────────────────────────────────────

alter table public.customers enable row level security;
alter table public.customer_users enable row level security;
alter table public.device_registry enable row level security;
alter table public.device_assignment_history enable row level security;
alter table public.billing_plans enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_lines enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'customer_users', 'device_registry'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using '
      || '(public.has_permission(''customers.read'') or public.has_permission(''customers.manage''))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using '
      || '(public.has_permission(''customers.manage'')) with check (public.has_permission(''customers.manage''))',
      t || '_write', t);
  end loop;

  foreach t in array array['billing_plans', 'billing_subscriptions', 'billing_invoices', 'billing_invoice_lines'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using '
      || '(public.has_permission(''billing.read'') or public.has_permission(''billing.manage''))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using '
      || '(public.has_permission(''billing.manage'')) with check (public.has_permission(''billing.manage''))',
      t || '_write', t);
  end loop;
end;
$$;

-- History is written by the trigger only.
drop policy if exists device_assignment_history_read on public.device_assignment_history;
create policy device_assignment_history_read on public.device_assignment_history
  for select to authenticated
  using (public.has_permission('customers.read') or public.has_permission('customers.manage'));

grant select, insert, update, delete on
  public.customers,
  public.customer_users,
  public.device_registry,
  public.billing_plans,
  public.billing_subscriptions,
  public.billing_invoices,
  public.billing_invoice_lines
to authenticated;
grant select on
  public.device_assignment_history,
  public.billing_invoices_view,
  public.customer_device_counts
to authenticated;
grant usage on sequence public.billing_invoice_number_seq to authenticated;

-- ─── permissions ────────────────────────────────────────────────────────────

-- Owners and admins get the new keys. If role_permissions has a different
-- shape on this server, grant the four keys by hand and re-login.
do $$
begin
  insert into public.role_permissions (role, permission) values
    ('owner', 'customers.read'), ('owner', 'customers.manage'),
    ('owner', 'billing.read'), ('owner', 'billing.manage'),
    ('admin', 'customers.read'), ('admin', 'customers.manage'),
    ('admin', 'billing.read'), ('admin', 'billing.manage'),
    ('manager', 'customers.read')
  on conflict do nothing;
exception when others then
  raise warning 'super admin: could not add role permissions (%). Grant customers.* / billing.* manually.', sqlerrm;
end;
$$;

-- A starting plan so billing works out of the box (prices in ILS, before VAT).
insert into public.billing_plans (name, description, price_per_device, base_price, setup_fee, cycle, sort_order)
select 'בסיסי', 'מעקב חי, היסטוריה ודוחות', 39, 0, 0, 'monthly', 1
where not exists (select 1 from public.billing_plans);

commit;
