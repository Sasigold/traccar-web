-- viper fleet: billing integrity (SEC-09). Idempotent.
--
-- "Edit only while a draft" was enforced by the interface only; saving a bill deleted and
-- re-inserted its lines in separate requests (a failure in between left a partial bill); the
-- number could be set by hand; and nothing in the platform tables was audited. Now:
--
--   - a bill's number always comes from the sequence, and never changes
--   - once a bill is not a draft, only its status, payment details and notes change; it never goes
--     back to draft; its lines are locked; it is cancelled, not deleted
--   - billing_save_invoice(invoice, lines) saves a bill and replaces its lines in one transaction
--   - every change to customers, their users, the device registry, plans, subscriptions, bills
--     and bill lines goes to audit_log
--
-- Server-side code (the billing-documents edge function, migrations) is not limited.

begin;

create or replace function public.billing_is_service()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or current_user in ('service_role', 'postgres', 'supabase_admin')
$$;

-- ─── bills ───────────────────────────────────────────────────────────────────

create or replace function public.billing_invoice_guard()
returns trigger
language plpgsql
as $$
declare
  -- What may change on a bill that is no longer a draft. The official document fields are
  -- guarded on their own (billing_official_guard: the provider only, or releasing a stuck claim).
  open_fields text[] := array['status', 'paid_at', 'payment_method', 'payment_reference', 'notes',
                              'updated_at', 'subtotal', 'vat_amount', 'total',
                              'official_state', 'official_type', 'official_id', 'official_number',
                              'official_url', 'official_amount', 'official_issued_at',
                              'official_error', 'receipt_state', 'receipt_id', 'receipt_number',
                              'receipt_url', 'payment_url', 'payment_token'];
begin
  if tg_op = 'INSERT' then
    new.number := nextval('public.billing_invoice_number_seq');
    return new;
  end if;
  if new.number is distinct from old.number then
    raise exception 'a bill keeps its number' using errcode = '42501';
  end if;
  if public.billing_is_service() then
    return new;
  end if;
  if old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'an issued bill does not go back to draft' using errcode = '42501';
    end if;
    if (to_jsonb(new) - open_fields) is distinct from (to_jsonb(old) - open_fields) then
      raise exception 'an issued bill changes only its status, payment and notes; cancel it and issue a new one'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists billing_invoice_guard on public.billing_invoices;
create trigger billing_invoice_guard before insert or update on public.billing_invoices
  for each row execute function public.billing_invoice_guard();

create or replace function public.billing_invoice_delete_draft_only()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'draft' and not public.billing_is_service() then
    raise exception 'an issued bill is cancelled, not deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists billing_invoice_delete_draft_only on public.billing_invoices;
create trigger billing_invoice_delete_draft_only before delete on public.billing_invoices
  for each row execute function public.billing_invoice_delete_draft_only();

create or replace function public.billing_lines_draft_only()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.billing_invoices
   where id = coalesce(new.invoice_id, old.invoice_id);
  -- No parent: the bill itself is being deleted (only a draft can be).
  if v_status is not null and v_status <> 'draft' and not public.billing_is_service() then
    raise exception 'the lines of an issued bill cannot change' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists billing_lines_draft_only on public.billing_invoice_lines;
create trigger billing_lines_draft_only before insert or update or delete on public.billing_invoice_lines
  for each row execute function public.billing_lines_draft_only();

-- One transaction for a bill and its lines. p_lines null keeps the lines. The lines are replaced
-- while the bill is still a draft, and the requested status is set last, so "issue" works in one
-- call. Runs with the caller's rights: row security (billing.manage) applies.
create or replace function public.billing_save_invoice(p_invoice jsonb, p_lines jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_id uuid := nullif(p_invoice->>'id', '')::uuid;
  v_status text := coalesce(p_invoice->>'status', 'draft');
  v_current text;
  has text[] := array(select jsonb_object_keys(p_invoice));
begin
  if v_status not in ('draft', 'issued', 'paid', 'cancelled') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.billing_invoices
      (customer_id, issue_date, due_date, period_start, period_end, vat_rate,
       payment_method, payment_reference, notes, status)
    values ((p_invoice->>'customer_id')::uuid,
            coalesce((p_invoice->>'issue_date')::date, current_date),
            coalesce((p_invoice->>'due_date')::date, current_date + 30),
            (p_invoice->>'period_start')::date, (p_invoice->>'period_end')::date,
            coalesce((p_invoice->>'vat_rate')::numeric, 18),
            p_invoice->>'payment_method', p_invoice->>'payment_reference', p_invoice->>'notes',
            'draft')
    returning id into v_id;
    v_current := 'draft';
  else
    select status into v_current from public.billing_invoices where id = v_id for update;
    if v_current is null then
      raise exception 'no such bill' using errcode = 'P0002';
    end if;
  end if;

  if p_lines is not null then
    if v_current <> 'draft' then
      raise exception 'the lines of an issued bill cannot change' using errcode = '42501';
    end if;
    delete from public.billing_invoice_lines where invoice_id = v_id;
    insert into public.billing_invoice_lines (invoice_id, description, quantity, unit_price, sort_order)
    select v_id, line->>'description', coalesce((line->>'quantity')::numeric, 0),
           coalesce((line->>'unit_price')::numeric, 0), (ordinality - 1)::integer
      from jsonb_array_elements(p_lines) with ordinality as l(line, ordinality)
     where coalesce(trim(line->>'description'), '') <> '';
  end if;

  update public.billing_invoices i set
    customer_id = case when 'customer_id' = any (has) then (p_invoice->>'customer_id')::uuid else i.customer_id end,
    issue_date = case when 'issue_date' = any (has) then (p_invoice->>'issue_date')::date else i.issue_date end,
    due_date = case when 'due_date' = any (has) then (p_invoice->>'due_date')::date else i.due_date end,
    period_start = case when 'period_start' = any (has) then (p_invoice->>'period_start')::date else i.period_start end,
    period_end = case when 'period_end' = any (has) then (p_invoice->>'period_end')::date else i.period_end end,
    vat_rate = case when 'vat_rate' = any (has) then (p_invoice->>'vat_rate')::numeric else i.vat_rate end,
    payment_method = case when 'payment_method' = any (has) then p_invoice->>'payment_method' else i.payment_method end,
    payment_reference = case when 'payment_reference' = any (has) then p_invoice->>'payment_reference' else i.payment_reference end,
    notes = case when 'notes' = any (has) then p_invoice->>'notes' else i.notes end,
    status = case when 'status' = any (has) then v_status else i.status end
  where i.id = v_id
    -- Untouched fields of an issued bill are not "changed": write only what differs.
    and (v_current = 'draft' or 'status' = any (has) or 'notes' = any (has)
         or 'payment_method' = any (has) or 'payment_reference' = any (has));
  return v_id;
end;
$$;

revoke all on function public.billing_save_invoice(jsonb, jsonb) from public, anon;
grant execute on function public.billing_save_invoice(jsonb, jsonb) to authenticated;

-- ─── audit ───────────────────────────────────────────────────────────────────

-- Platform tables have no org_id, and some no id column: the row is named by its key.
create or replace function public.audit_platform_row()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (org_id, user_id, action, table_name, row_id, old_data, new_data)
  values (null, auth.uid(), lower(tg_op), tg_table_name,
          coalesce(rec->>'id', rec->>'traccar_device_id', rec->>'traccar_user_id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'customer_users', 'device_registry', 'billing_plans',
                           'billing_subscriptions', 'billing_invoices', 'billing_invoice_lines']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I '
                   'for each row execute function public.audit_platform_row()', t || '_audit', t);
  end loop;
end $$;

commit;
