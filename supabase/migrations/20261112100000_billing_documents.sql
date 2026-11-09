-- viper fleet: official tax documents through an authorized provider (BIZ-01). Idempotent.
--
-- The bills in the super admin area are payment requests. A tax invoice with an allocation number
-- (מספר הקצאה) comes from a provider that is connected to the Tax Authority; the first one is
-- Morning (Green Invoice). The `billing-documents` edge function talks to it; this migration keeps
-- the state:
--
--   billing_provider        one row: which provider, production or sandbox, the clearing page
--   customers               + provider_client_id: the customer as a client at the provider
--   billing_invoices        + the official invoice (or invoice-receipt), the receipt, the payment
--                             page and a random token for the provider's payment notification
--   billing_set_secret()    platform administrators store the provider's API key id and secret in
--                           Vault; billing_provider_status() says whether they are set; only the
--                           service role reads them (billing_provider_credentials()).
--
-- Once an official invoice exists, the bill's customer, dates, VAT and lines are locked: a tax
-- invoice is corrected by a credit invoice at the provider, not by editing it here.

begin;

create table if not exists public.billing_provider (
  id boolean primary key default true check (id),
  provider text not null default 'morning' check (provider in ('morning')),
  enabled boolean not null default false,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  clearing boolean not null default false,
  max_payments integer not null default 1 check (max_payments between 1 and 36),
  updated_at timestamptz not null default now()
);

comment on table public.billing_provider is
  'The provider that issues official tax documents (BIZ-01). One row. Keys are in Vault.';

alter table public.billing_provider enable row level security;

drop policy if exists billing_provider_read on public.billing_provider;
create policy billing_provider_read on public.billing_provider for select to authenticated
  using (public.has_permission('billing.read'));
drop policy if exists billing_provider_write on public.billing_provider;
create policy billing_provider_write on public.billing_provider for all to authenticated
  using (public.has_permission('billing.manage'))
  with check (public.has_permission('billing.manage'));
grant select, insert, update on public.billing_provider to authenticated;

alter table public.customers add column if not exists provider_client_id text;

alter table public.billing_invoices
  add column if not exists official_state text
    check (official_state in ('working', 'done', 'failed')),
  add column if not exists official_type integer,
  add column if not exists official_id text,
  add column if not exists official_number bigint,
  add column if not exists official_url text,
  add column if not exists official_amount numeric(12, 2),
  add column if not exists official_issued_at timestamptz,
  add column if not exists official_error text,
  add column if not exists receipt_state text check (receipt_state in ('working', 'done', 'failed')),
  add column if not exists receipt_id text,
  add column if not exists receipt_number bigint,
  add column if not exists receipt_url text,
  add column if not exists payment_url text,
  add column if not exists payment_token text;

-- The view lists i.*; recreate it so the new columns show.
drop view if exists public.billing_invoices_view;
create view public.billing_invoices_view
with (security_invoker = true)
as
select
  i.*,
  c.name as customer_name,
  (i.status = 'issued' and i.due_date < current_date) as is_overdue
from public.billing_invoices i
join public.customers c on c.id = i.customer_id;
grant select on public.billing_invoices_view to authenticated;

-- Only the edge function (service role) records official documents, and an issued tax invoice is
-- not edited. Status, payment details and notes stay editable.
create or replace function public.billing_official_guard()
returns trigger
language plpgsql
as $$
declare
  service boolean := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or current_user in ('service_role', 'postgres', 'supabase_admin');
begin
  if service then
    return new;
  end if;
  if (new.official_state, new.official_type, new.official_id, new.official_number, new.official_url,
      new.official_amount, new.official_issued_at, new.receipt_state, new.receipt_id,
      new.receipt_number, new.receipt_url, new.payment_url, new.payment_token)
     is distinct from
     (old.official_state, old.official_type, old.official_id, old.official_number, old.official_url,
      old.official_amount, old.official_issued_at, old.receipt_state, old.receipt_id,
      old.receipt_number, old.receipt_url, old.payment_url, old.payment_token) then
    -- The one exception: after checking the provider, an administrator may release a stuck
    -- "working" claim by marking it failed, changing nothing else.
    -- (coalesce: with a NULL state the comparison is NULL, and NOT NULL would let it through.)
    if not (
      (new.official_type, new.official_id, new.official_number, new.official_url,
       new.official_amount, new.official_issued_at, new.receipt_id, new.receipt_number,
       new.receipt_url, new.payment_url, new.payment_token)
      is not distinct from
      (old.official_type, old.official_id, old.official_number, old.official_url,
       old.official_amount, old.official_issued_at, old.receipt_id, old.receipt_number,
       old.receipt_url, old.payment_url, old.payment_token)
      and (coalesce(old.official_state = 'working' and new.official_state = 'failed'
                    and new.receipt_state is not distinct from old.receipt_state, false)
           or coalesce(old.receipt_state = 'working' and new.receipt_state = 'failed'
                    and new.official_state is not distinct from old.official_state, false))
    ) then
      raise exception 'official document fields are set by the provider only' using errcode = '42501';
    end if;
  end if;
  if (old.official_id is not null or old.official_state = 'working')
     and (new.customer_id, new.issue_date, new.due_date, new.vat_rate, new.subtotal, new.total)
         is distinct from
         (old.customer_id, old.issue_date, old.due_date, old.vat_rate, old.subtotal, old.total) then
    raise exception 'an official invoice was issued; correct it with a credit invoice at the provider'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists billing_official_guard on public.billing_invoices;
create trigger billing_official_guard before update on public.billing_invoices
  for each row execute function public.billing_official_guard();

-- Lines of a bill with an official invoice are locked too.
create or replace function public.billing_lines_guard()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if exists (select 1 from public.billing_invoices
              where id = v_invoice and (official_id is not null or official_state = 'working')) then
    raise exception 'an official invoice was issued; its lines cannot change' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists billing_lines_guard on public.billing_invoice_lines;
create trigger billing_lines_guard before insert or update or delete on public.billing_invoice_lines
  for each row execute function public.billing_lines_guard();

-- A bill with an official document is kept.
create or replace function public.billing_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if old.official_id is not null or old.official_state = 'working' then
    raise exception 'a bill with an official document cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists billing_delete_guard on public.billing_invoices;
create trigger billing_delete_guard before delete on public.billing_invoices
  for each row execute function public.billing_delete_guard();

-- ─── keys in Vault ───────────────────────────────────────────────────────────

create or replace function public.billing_secret(p_name text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  value text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into value using 'billing_' || p_name;
  return value;
end;
$$;

revoke all on function public.billing_secret(text) from public, anon, authenticated;

create or replace function public.billing_set_secret(p_name text, p_secret text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_name not in ('morning_id', 'morning_secret') or coalesce(trim(p_secret), '') = '' then
    raise exception 'invalid key name or value' using errcode = '22023';
  end if;
  if to_regclass('vault.secrets') is null then
    raise exception 'Supabase Vault is not available' using errcode = '55000';
  end if;
  execute 'select id from vault.secrets where name = $1 limit 1'
    into secret_id using 'billing_' || p_name;
  if secret_id is null then
    execute 'select vault.create_secret($1, $2)' using trim(p_secret), 'billing_' || p_name;
  else
    execute 'select vault.update_secret($1, $2)' using secret_id, trim(p_secret);
  end if;
end;
$$;

revoke all on function public.billing_set_secret(text, text) from public, anon;
grant execute on function public.billing_set_secret(text, text) to authenticated;

create or replace function public.billing_provider_status()
returns table (has_id boolean, has_secret boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.billing_secret('morning_id') is not null,
         public.billing_secret('morning_secret') is not null
   where public.is_platform_admin();
$$;

revoke all on function public.billing_provider_status() from public, anon;
grant execute on function public.billing_provider_status() to authenticated;

create or replace function public.billing_provider_credentials()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object('id', public.billing_secret('morning_id'),
                            'secret', public.billing_secret('morning_secret'));
$$;

revoke all on function public.billing_provider_credentials() from public, anon, authenticated;
grant execute on function public.billing_provider_credentials() to service_role;

-- ─── claims ──────────────────────────────────────────────────────────────────

-- The edge function claims a bill before it calls the provider, so a double click or two
-- administrators never produce two tax documents. kind: invoice | receipt | link.
-- Returns the bill with its lines and customer, or { error } with the reason.
create or replace function public.billing_document_claim(p_invoice uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv public.billing_invoices;
begin
  select * into inv from public.billing_invoices where id = p_invoice for update;
  if inv.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if inv.status not in ('issued', 'paid') then
    return jsonb_build_object('error', 'not_issued');
  end if;
  if inv.total <= 0 then
    return jsonb_build_object('error', 'no_amount');
  end if;

  if p_kind = 'invoice' then
    if inv.official_id is not null then
      return jsonb_build_object('error', 'already');
    end if;
    if inv.official_state = 'working' then
      return jsonb_build_object('error', 'busy');
    end if;
    update public.billing_invoices set official_state = 'working', official_error = null
     where id = p_invoice;
  elsif p_kind = 'receipt' then
    if inv.status <> 'paid' then
      return jsonb_build_object('error', 'not_paid');
    end if;
    if inv.official_type is distinct from 305 then
      return jsonb_build_object('error', 'no_invoice');
    end if;
    if inv.receipt_id is not null then
      return jsonb_build_object('error', 'already');
    end if;
    if inv.receipt_state = 'working' then
      return jsonb_build_object('error', 'busy');
    end if;
    update public.billing_invoices set receipt_state = 'working', official_error = null
     where id = p_invoice;
  elsif p_kind = 'link' then
    -- The payment page makes the invoice-receipt itself, so only before any official document.
    if inv.status <> 'issued' then
      return jsonb_build_object('error', 'not_open');
    end if;
    if inv.official_id is not null or inv.official_state = 'working' then
      return jsonb_build_object('error', 'already');
    end if;
    update public.billing_invoices
       set payment_token = coalesce(payment_token,
             replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
     where id = p_invoice;
  else
    return jsonb_build_object('error', 'bad_kind');
  end if;

  return (
    select jsonb_build_object(
      'invoice', to_jsonb(i),
      'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order)
                           from public.billing_invoice_lines l where l.invoice_id = i.id), '[]'::jsonb),
      'customer', to_jsonb(c),
      'provider', (select to_jsonb(p) from public.billing_provider p))
      from public.billing_invoices i
      join public.customers c on c.id = i.customer_id
     where i.id = p_invoice
  );
end;
$$;

revoke all on function public.billing_document_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.billing_document_claim(uuid, text) to service_role;

commit;
