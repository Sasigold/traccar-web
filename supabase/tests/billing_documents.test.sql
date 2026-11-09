-- Official tax documents (BIZ-01): keys only in Vault, one claim at a time, and an issued tax
-- invoice that cannot be edited, deleted or faked from the API.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

insert into public.organizations (id, name) values ('a3000000-0000-0000-0000-000000000000', 'Service');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000003a1', 'a3000000-0000-0000-0000-000000000000', 'admin'),
  ('00000000-0000-0000-0000-0000000003a2', 'a3000000-0000-0000-0000-000000000000', 'owner');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000003a1');
insert into public.customers (id, name, company_number) values
  ('c3000000-0000-0000-0000-000000000001', 'הובלות הצפון', '515555555');
insert into public.billing_invoices (id, customer_id, status) values
  ('b3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'issued'),
  ('b3000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', 'draft');
insert into public.billing_invoice_lines (invoice_id, description, quantity, unit_price) values
  ('b3000000-0000-0000-0000-000000000001', 'מנוי', 1, 1000),
  ('b3000000-0000-0000-0000-000000000002', 'מנוי', 1, 500);
update public.billing_invoices set status = status where id = 'b3000000-0000-0000-0000-000000000001';

-- Keys: platform administrators store them, nobody reads them back through the API.
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a2');
do $$ begin
  begin
    perform public.billing_set_secret('morning_id', 'x');
    assert false, 'an organization owner cannot set the provider keys';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
select public.billing_set_secret('morning_id', 'key-id');
select public.billing_set_secret('morning_secret', 'key-secret');
do $$ begin
  assert (select has_id and has_secret from public.billing_provider_status()), 'both keys set';
  begin
    perform public.billing_provider_credentials();
    assert false, 'a signed-in user cannot read the keys';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.billing_set_secret('other', 'x');
    assert false, 'only known key names';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'invoice');
    assert false, 'only the service role claims';
  exception when insufficient_privilege then null;
  end;
  -- Official fields cannot be written from the API.
  begin
    update public.billing_invoices set official_id = 'fake', official_number = 1
     where id = 'b3000000-0000-0000-0000-000000000001';
    assert false, 'official fields are the provider''s';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_admin();
do $$
declare
  v jsonb;
begin
  assert (public.billing_provider_credentials()->>'secret') = 'key-secret', 'the service role reads the keys';

  assert public.billing_document_claim('b3000000-0000-0000-0000-000000000002', 'invoice')->>'error'
    = 'not_issued', 'a draft is not invoiced';
  v := public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'invoice');
  assert v->'invoice'->>'official_state' = 'working', 'claimed';
  assert (v->'invoice'->>'total')::numeric = 1180, 'total with VAT';
  assert jsonb_array_length(v->'lines') = 1 and v->'customer'->>'company_number' = '515555555',
    'lines and customer come with the claim';
  assert public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'invoice')->>'error'
    = 'busy', 'a second claim waits';
  assert public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'link')->>'error'
    = 'already', 'no payment page while an invoice is being issued';
end $$;

-- While it is being issued, the lines are locked.
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
do $$ begin
  begin
    update public.billing_invoice_lines set unit_price = 1
     where invoice_id = 'b3000000-0000-0000-0000-000000000001';
    assert false, 'lines locked while issuing';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The provider answered: the edge function records the invoice.
select pg_temp.as_admin();
update public.billing_invoices
   set official_state = 'done', official_type = 305, official_id = 'doc-1', official_number = 20001,
       official_url = 'https://example.com/doc', official_amount = 1180, official_issued_at = now()
 where id = 'b3000000-0000-0000-0000-000000000001';

select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
do $$ begin
  begin
    update public.billing_invoices set vat_rate = 0 where id = 'b3000000-0000-0000-0000-000000000001';
    assert false, 'an issued tax invoice keeps its amounts';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.billing_invoices where id = 'b3000000-0000-0000-0000-000000000001';
    assert false, 'an issued tax invoice is kept';
  exception when insufficient_privilege then null;
  end;
  -- Notes and recording the payment are still allowed.
  update public.billing_invoices set notes = 'הערה' where id = 'b3000000-0000-0000-0000-000000000001';
  assert (select notes = 'הערה' from public.billing_invoices
           where id = 'b3000000-0000-0000-0000-000000000001'), 'notes saved';
  update public.billing_invoices set status = 'paid', payment_method = 'transfer'
   where id = 'b3000000-0000-0000-0000-000000000001';
  assert (select status = 'paid' and paid_at is not null from public.billing_invoices
           where id = 'b3000000-0000-0000-0000-000000000001'), 'paid';
end $$;

select pg_temp.as_admin();
do $$
declare
  v jsonb;
begin
  assert public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'invoice')->>'error'
    = 'already', 'one invoice per bill';
  v := public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'receipt');
  assert v->'invoice'->>'receipt_state' = 'working', 'a receipt for the paid invoice';
  assert public.billing_document_claim('b3000000-0000-0000-0000-000000000001', 'receipt')->>'error'
    = 'busy', 'one receipt at a time';
end $$;

-- An administrator may release a stuck claim after checking the provider, and nothing else.
select pg_temp.as_user('00000000-0000-0000-0000-0000000003a1');
do $$ begin
  begin
    update public.billing_invoices set receipt_state = 'failed', receipt_number = 99
     where id = 'b3000000-0000-0000-0000-000000000001';
    assert false, 'releasing a claim changes nothing else';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.billing_invoices set receipt_state = 'failed' where id = 'b3000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select receipt_state = 'failed' from public.billing_invoices
           where id = 'b3000000-0000-0000-0000-000000000001'), 'released';
end $$;

-- A payment page gets a random notification token.
select pg_temp.as_admin();
update public.billing_invoices set status = 'issued' where id = 'b3000000-0000-0000-0000-000000000002';
do $$
declare
  v jsonb;
begin
  v := public.billing_document_claim('b3000000-0000-0000-0000-000000000002', 'link');
  assert length(v->'invoice'->>'payment_token') = 64, 'a long random token';
  assert (public.billing_document_claim('b3000000-0000-0000-0000-000000000002', 'link')
          ->'invoice'->>'payment_token') = v->'invoice'->>'payment_token', 'the same token again';
end $$;

rollback;
