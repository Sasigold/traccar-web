-- Billing integrity (SEC-09): numbers from the server, issued bills locked, lines replaced in one
-- transaction, and every platform change audited.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values ('a5000000-0000-0000-0000-000000000000', 'Service');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000005a1', 'a5000000-0000-0000-0000-000000000000', 'admin'),
  ('00000000-0000-0000-0000-0000000005a2', 'a5000000-0000-0000-0000-000000000000', 'owner');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000005a1');
insert into public.customers (id, name) values ('c5000000-0000-0000-0000-000000000001', 'לקוח');

select pg_temp.as_user('00000000-0000-0000-0000-0000000005a1');

do $$
declare
  v_id uuid;
  v_draft uuid;
  v_number bigint;
  r public.billing_invoices;
begin
  -- A new bill with its lines, issued in one call; a number chosen by the client is ignored.
  v_id := public.billing_save_invoice(
    '{"customer_id": "c5000000-0000-0000-0000-000000000001", "number": 1, "vat_rate": 18, "status": "issued"}',
    '[{"description": "מנוי", "quantity": 10, "unit_price": 50}, {"description": " ", "quantity": 1, "unit_price": 1}]');
  select * into r from public.billing_invoices where id = v_id;
  assert r.status = 'issued', 'issued in the same call';
  assert r.number <> 1 and r.number >= 1001, 'the number comes from the sequence';
  assert r.total = 590, format('totals follow the lines: %s', r.total);
  assert (select count(*) from public.billing_invoice_lines where invoice_id = v_id) = 1,
    'empty lines are dropped';

  -- An issued bill: status, payment and notes only.
  update public.billing_invoices set notes = 'הועבר', payment_method = 'transfer' where id = v_id;
  begin
    update public.billing_invoices set vat_rate = 0 where id = v_id;
    assert false, 'the VAT of an issued bill is locked';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.billing_invoices set customer_id = customer_id, due_date = due_date + 1 where id = v_id;
    assert false, 'the dates of an issued bill are locked';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.billing_invoices set number = number + 1 where id = v_id;
    assert false, 'a bill keeps its number';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.billing_invoices set status = 'draft' where id = v_id;
    assert false, 'no way back to draft';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.billing_save_invoice(jsonb_build_object('id', v_id), '[{"description": "x", "quantity": 1, "unit_price": 1}]');
    assert false, 'lines of an issued bill are locked (function)';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.billing_invoice_lines (invoice_id, description) values (v_id, 'x');
    assert false, 'lines of an issued bill are locked (table)';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.billing_invoices where id = v_id;
    assert false, 'an issued bill is cancelled, not deleted';
  exception when insufficient_privilege then null;
  end;
  perform public.billing_save_invoice(jsonb_build_object('id', v_id, 'status', 'paid'));
  assert (select status = 'paid' and paid_at is not null from public.billing_invoices where id = v_id),
    'paid';
  update public.billing_invoices set status = 'cancelled' where id = v_id;

  -- A draft changes freely, its lines are replaced in one call, and it can be deleted.
  v_draft := public.billing_save_invoice('{"customer_id": "c5000000-0000-0000-0000-000000000001"}',
    '[{"description": "א", "quantity": 1, "unit_price": 100}]');
  perform public.billing_save_invoice(jsonb_build_object('id', v_draft, 'vat_rate', 0),
    '[{"description": "ב", "quantity": 2, "unit_price": 100}, {"description": "ג", "quantity": 1, "unit_price": 5}]');
  assert (select total from public.billing_invoices where id = v_draft) = 205, 'replaced lines';
  assert (select string_agg(description, ',' order by sort_order) from public.billing_invoice_lines
           where invoice_id = v_draft) = 'ב,ג', 'in order';
  -- A failure in the middle changes nothing.
  select number into v_number from public.billing_invoices where id = v_draft;
  begin
    perform public.billing_save_invoice(jsonb_build_object('id', v_draft),
      '[{"description": "ד", "quantity": "many", "unit_price": 1}]');
    assert false, 'a bad line fails';
  exception when invalid_text_representation then null;
  end;
  assert (select count(*) from public.billing_invoice_lines where invoice_id = v_draft) = 2,
    'the old lines are still there';
  delete from public.billing_invoices where id = v_draft;
end $$;

-- An organization owner is not a platform administrator: row security refuses.
select pg_temp.as_user('00000000-0000-0000-0000-0000000005a2');
do $$ begin
  begin
    perform public.billing_save_invoice('{"customer_id": "c5000000-0000-0000-0000-000000000001"}', '[]');
    assert false, 'an organization owner cannot bill';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Everything is in the audit log, with who did it.
reset role;
do $$ begin
  assert (select count(*) from public.audit_log where table_name = 'billing_invoices'
           and user_id = '00000000-0000-0000-0000-0000000005a1') >= 5, 'bills are audited';
  assert exists (select 1 from public.audit_log where table_name = 'billing_invoice_lines'
                  and action = 'delete'), 'replaced lines are audited';
  assert exists (select 1 from public.audit_log where table_name = 'customers' and action = 'insert'),
    'customers are audited';
end $$;

rollback;
\echo 'billing_integrity.test.sql: all assertions passed'
