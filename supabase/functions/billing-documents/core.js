import {
  DOCUMENT_TYPES,
  clientOf,
  invoiceDocument,
  paymentForm,
  paymentTypeOf,
  receiptDocument,
  sameAmount,
} from './documents.js';
import { ProviderError } from './morning.js';

// The billing-documents edge function (BIZ-01), without Deno: handle(request, deps) → Response.
//
//   POST /issue         {invoice_id}  the tax invoice (or invoice-receipt when paid)
//   POST /receipt       {invoice_id}  the receipt for a paid bill with a tax invoice
//   POST /payment-link  {invoice_id}  the provider's card payment page
//   POST /notify?invoice=&token=      the provider's call after a card payment (no user)
//
// The first three are for platform administrators only (their fleet JWT is checked with the
// database). deps: { db, morningFor(provider, credentials), publicUrl, today() }, where db has
// isPlatformAdmin(jwt), claim(id, kind), updateInvoice(id, patch), updateCustomer(id, patch),
// credentials(), loadForNotify(id) → { invoice, customer, provider }.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
    },
  });

const fail = (status, code, message = code) => json(status, { error: { code, message } });

const CLAIM_ERRORS = {
  not_found: 404,
  not_issued: 409,
  no_amount: 409,
  already: 409,
  busy: 409,
  not_paid: 409,
  no_invoice: 409,
  not_open: 409,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compares two strings in time that does not depend on where they differ.
export const safeEqual = (a, b) => {
  const left = String(a ?? '');
  const right = String(b ?? '');
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0 && left.length > 0;
};

const routeOf = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  const at = parts.lastIndexOf('billing-documents');
  return (at >= 0 ? parts.slice(at + 1) : parts).join('/');
};

const bearerOf = (request) => {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return match ? match[1].trim() : null;
};

const officialUrl = (url) => url?.he || url?.origin || url?.en || null;

// Makes sure the customer exists at the provider and returns its id there.
const ensureClient = async ({ db, morning, customer }) => {
  if (customer.provider_client_id) {
    return customer.provider_client_id;
  }
  const created = await morning.addClient(clientOf(customer));
  if (!created?.id) {
    throw new ProviderError('Morning: the client was not created');
  }
  await db.updateCustomer(customer.id, { provider_client_id: created.id });
  return created.id;
};

const providerReady = (provider) => Boolean(provider?.enabled);

const issue = async ({ db, morningFor }, invoiceId) => {
  const claim = await db.claim(invoiceId, 'invoice');
  if (claim?.error) {
    return fail(CLAIM_ERRORS[claim.error] ?? 400, claim.error);
  }
  const { invoice, lines, customer, provider } = claim;
  const release = (patch) => db.updateInvoice(invoice.id, { official_state: null, ...patch });

  if (!providerReady(provider)) {
    await release({ official_error: 'provider_disabled' });
    return fail(409, 'provider_disabled');
  }
  const paymentType = invoice.status === 'paid' ? paymentTypeOf(invoice.payment_method) : null;
  if (invoice.status === 'paid' && !paymentType) {
    await release({ official_error: 'payment_method' });
    return fail(409, 'payment_method');
  }

  let created;
  let morning;
  try {
    morning = morningFor(provider, await db.credentials());
    const clientId = await ensureClient({ db, morning, customer });
    created = await morning.addDocument(invoiceDocument({ invoice, lines, clientId, paymentType }));
    if (!created?.id) {
      throw new ProviderError('Morning: no document id in the answer');
    }
  } catch (error) {
    await db.updateInvoice(invoice.id, {
      official_state: 'failed',
      official_error: String(error.message || error).slice(0, 500),
    });
    return fail(error.status ?? 502, error.code ?? 'provider_error', error.message);
  }

  // The document exists at the provider: record it whatever happens next.
  let amount;
  try {
    amount = Number((await morning.getDocument(created.id))?.amount);
  } catch {
    amount = null;
  }
  const mismatch = amount != null && !Number.isNaN(amount) && !sameAmount(amount, invoice.total);
  const patch = {
    official_state: 'done',
    official_type:
      invoice.status === 'paid' ? DOCUMENT_TYPES.invoiceReceipt : DOCUMENT_TYPES.invoice,
    official_id: created.id,
    official_number: created.number ?? null,
    official_url: officialUrl(created.url),
    official_amount: Number.isNaN(amount) ? null : amount,
    official_issued_at: new Date().toISOString(),
    official_error: mismatch ? 'amount_mismatch' : null,
  };
  try {
    await db.updateInvoice(invoice.id, patch);
  } catch {
    // The claim stays "working", so nothing is issued twice; the number is in the log and the
    // answer for the administrator to record.
    console.error(`billing-documents: document ${created.id} (${created.number}) not recorded`);
    return fail(
      500,
      'not_recorded',
      `Morning document ${created.number} was issued but not saved.`,
    );
  }
  return json(200, { official: patch });
};

const receipt = async ({ db, morningFor }, invoiceId) => {
  const claim = await db.claim(invoiceId, 'receipt');
  if (claim?.error) {
    return fail(CLAIM_ERRORS[claim.error] ?? 400, claim.error);
  }
  const { invoice, customer, provider } = claim;
  const release = (patch) => db.updateInvoice(invoice.id, { receipt_state: null, ...patch });
  if (!providerReady(provider)) {
    await release({ official_error: 'provider_disabled' });
    return fail(409, 'provider_disabled');
  }
  const paymentType = paymentTypeOf(invoice.payment_method);
  if (!paymentType) {
    await release({ official_error: 'payment_method' });
    return fail(409, 'payment_method');
  }
  let created;
  try {
    const morning = morningFor(provider, await db.credentials());
    const clientId = await ensureClient({ db, morning, customer });
    created = await morning.addDocument(receiptDocument({ invoice, clientId, paymentType }));
    if (!created?.id) {
      throw new ProviderError('Morning: no document id in the answer');
    }
  } catch (error) {
    await db.updateInvoice(invoice.id, {
      receipt_state: 'failed',
      official_error: String(error.message || error).slice(0, 500),
    });
    return fail(error.status ?? 502, error.code ?? 'provider_error', error.message);
  }
  const patch = {
    receipt_state: 'done',
    receipt_id: created.id,
    receipt_number: created.number ?? null,
    receipt_url: officialUrl(created.url),
    official_error: null,
  };
  await db.updateInvoice(invoice.id, patch);
  return json(200, { receipt: patch });
};

const paymentLink = async ({ db, morningFor, publicUrl, today }, invoiceId) => {
  const claim = await db.claim(invoiceId, 'link');
  if (claim?.error) {
    return fail(CLAIM_ERRORS[claim.error] ?? 400, claim.error);
  }
  const { invoice, customer, provider } = claim;
  if (!providerReady(provider) || !provider.clearing) {
    return fail(409, 'clearing_disabled');
  }
  if (!/^https:\/\/[^/]+/.test(publicUrl || '')) {
    return fail(409, 'no_public_url');
  }
  try {
    const morning = morningFor(provider, await db.credentials());
    const clientId = await ensureClient({ db, morning, customer });
    const notify = new URL(`${publicUrl}/notify`);
    notify.searchParams.set('invoice', invoice.id);
    notify.searchParams.set('token', invoice.payment_token);
    const form = await morning.paymentForm(
      paymentForm({
        invoice,
        customer,
        clientId,
        maxPayments: provider.max_payments ?? 1,
        notifyUrl: notify.toString(),
        today: today(),
      }),
    );
    if (!form?.url) {
      throw new ProviderError('Morning: no payment page in the answer');
    }
    await db.updateInvoice(invoice.id, { payment_url: form.url });
    return json(200, { url: form.url });
  } catch (error) {
    return fail(error.status ?? 502, error.code ?? 'provider_error', error.message);
  }
};

// The provider calls this after a card payment. It is not signed, so it must carry the bill's
// random token, and the document it names is read back from the provider and checked: an
// invoice-receipt, for this bill's total, for this customer.
const notify = async ({ db, morningFor, today }, request, url) => {
  const invoiceId = url.searchParams.get('invoice');
  const token = url.searchParams.get('token');
  if (!UUID.test(invoiceId || '') || !token) {
    return fail(400, 'bad_request');
  }
  const loaded = await db.loadForNotify(invoiceId);
  if (!loaded?.invoice || !safeEqual(loaded.invoice.payment_token, token)) {
    return fail(403, 'forbidden');
  }
  const { invoice, customer, provider } = loaded;
  if (invoice.official_id) {
    return json(200, { ok: true, already: true });
  }
  const form = new URLSearchParams(await request.text());
  const documentId = form.get('id');
  if (!documentId) {
    return fail(400, 'bad_request');
  }
  let document;
  try {
    document = await morningFor(provider, await db.credentials()).getDocument(documentId);
  } catch (error) {
    return fail(502, 'provider_error', error.message);
  }
  const clientOk =
    !customer.provider_client_id || document?.client?.id === customer.provider_client_id;
  if (
    Number(document?.type) !== DOCUMENT_TYPES.invoiceReceipt ||
    !sameAmount(document?.amount, invoice.total) ||
    !clientOk
  ) {
    return fail(409, 'document_mismatch');
  }
  if (!customer.provider_client_id && document.client?.id) {
    await db.updateCustomer(customer.id, { provider_client_id: document.client.id });
  }
  await db.updateInvoice(invoice.id, {
    status: 'paid',
    paid_at: today(),
    payment_method: 'card',
    official_state: 'done',
    official_type: DOCUMENT_TYPES.invoiceReceipt,
    official_id: document.id ?? documentId,
    official_number: document.number ?? null,
    official_url: officialUrl(document.url),
    official_amount: Number(document.amount),
    official_issued_at: new Date().toISOString(),
    official_error: null,
  });
  return json(200, { ok: true });
};

export const handle = async (request, deps) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return fail(405, 'method_not_allowed');
  }
  const url = new URL(request.url);
  const route = routeOf(url.pathname);
  try {
    if (route === 'notify') {
      return await notify(deps, request, url);
    }
    const actions = { issue, receipt, 'payment-link': paymentLink };
    const action = actions[route];
    if (!action) {
      return fail(404, 'not_found');
    }
    const jwt = bearerOf(request);
    if (!jwt || !(await deps.db.isPlatformAdmin(jwt))) {
      return fail(403, 'forbidden');
    }
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!UUID.test(body?.invoice_id || '')) {
      return fail(400, 'bad_request');
    }
    return await action(deps, body.invoice_id);
  } catch {
    return fail(500, 'server_error');
  }
};
