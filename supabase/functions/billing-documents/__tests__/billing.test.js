import { describe, expect, it, vi } from 'vitest';
import { handle, safeEqual } from '../core.js';
import {
  sameAmount,
  clientOf,
  incomeOf,
  invoiceDocument,
  paymentTypeOf,
  receiptDocument,
} from '../documents.js';
import { MORNING_URLS, morningClient } from '../morning.js';

const ID = 'b3000000-0000-0000-0000-000000000001';
const BASE = 'https://api.example.com/functions/v1/billing-documents';

const customer = {
  id: 'c1',
  name: 'הובלות הצפון',
  company_number: '51-555555-5',
  billing_email: 'billing@example.com',
  email: 'office@example.com',
  phone: '04-1234567',
  provider_client_id: null,
};

const lines = [
  { description: 'מנוי', quantity: 3, unit_price: 100 },
  { description: 'מכשירים', quantity: 10, unit_price: 30 },
  { description: 'הנחה 10%', quantity: 1, unit_price: -60 },
];

const openInvoice = {
  id: ID,
  number: 1042,
  status: 'issued',
  issue_date: '2026-11-01',
  due_date: '2026-12-01',
  period_start: '2026-11-01',
  period_end: '2026-11-30',
  payment_method: 'transfer',
  paid_at: null,
  subtotal: 540,
  total: 637.2,
  payment_token: 't'.repeat(64),
};

const provider = { enabled: true, environment: 'sandbox', clearing: true, max_payments: 3 };

const fakeDb = (claim, extra = {}) => ({
  isPlatformAdmin: vi.fn(async (jwt) => jwt === 'admin-jwt'),
  claim: vi.fn(async () => claim),
  credentials: vi.fn(async () => ({ id: 'kid', secret: 'ksecret' })),
  updateInvoice: vi.fn(async () => null),
  updateCustomer: vi.fn(async () => null),
  loadForNotify: vi.fn(async () => null),
  ...extra,
});

const fakeMorning = (overrides = {}) => ({
  addClient: vi.fn(async () => ({ id: 'client-1' })),
  addDocument: vi.fn(async () => ({
    id: 'doc-1',
    number: 20001,
    url: { he: 'https://morning.example/doc-he', origin: 'https://morning.example/doc' },
  })),
  getDocument: vi.fn(async () => ({ id: 'doc-1', type: 305, amount: 637.2 })),
  paymentForm: vi.fn(async () => ({ errorCode: 0, url: 'https://secure.cardcom.example/pay' })),
  ...overrides,
});

const deps = (db, morning) => ({
  db,
  morningFor: vi.fn(() => morning),
  publicUrl: BASE,
  today: () => '2026-11-09',
});

const post = (path, body, jwt = 'admin-jwt') =>
  new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe('documents', () => {
  it('turns discount lines into one discount and keeps prices before VAT', () => {
    expect(incomeOf(lines)).toEqual({
      income: [
        { description: 'מנוי', quantity: 3, price: 100, currency: 'ILS', vatType: 0 },
        { description: 'מכשירים', quantity: 10, price: 30, currency: 'ILS', vatType: 0 },
      ],
      discount: { type: 'sum', amount: 60 },
    });
  });

  it('describes the customer with digits-only tax ID and the billing email', () => {
    expect(clientOf(customer)).toEqual({
      name: 'הובלות הצפון',
      taxId: '515555555',
      emails: ['billing@example.com'],
      phone: '04-1234567',
      active: true,
    });
  });

  it('issues a tax invoice for an open bill and an invoice-receipt for a paid one', () => {
    const open = invoiceDocument({ invoice: openInvoice, lines, clientId: 'c', paymentType: null });
    expect(open).toMatchObject({
      type: 305,
      date: '2026-11-01',
      dueDate: '2026-12-01',
      vatType: 0,
    });
    expect(open.payment).toBeUndefined();
    const paid = invoiceDocument({
      invoice: { ...openInvoice, status: 'paid', paid_at: '2026-11-05' },
      lines,
      clientId: 'c',
      paymentType: 4,
    });
    expect(paid).toMatchObject({ type: 320, client: { id: 'c' } });
    expect(paid.dueDate).toBeUndefined();
    expect(paid.payment).toEqual([{ type: 4, price: 637.2, currency: 'ILS', date: '2026-11-05' }]);
  });

  it('links the receipt to the tax invoice', () => {
    const doc = receiptDocument({
      invoice: { ...openInvoice, status: 'paid', paid_at: '2026-11-05', official_id: 'doc-1' },
      clientId: 'c',
      paymentType: 3,
    });
    expect(doc).toMatchObject({ type: 400, linkedDocumentIds: ['doc-1'] });
  });

  it('compares amounts to the agora', () => {
    expect(sameAmount(637.2, 637.19)).toBe(false);
    expect(sameAmount(637.2, '637.20')).toBe(true);
    expect(sameAmount(0.1 + 0.2, 0.3)).toBe(true);
    expect(sameAmount(undefined, 0)).toBe(false);
  });

  it('maps only payment methods the provider can record', () => {
    expect([paymentTypeOf('transfer'), paymentTypeOf('card'), paymentTypeOf('cash')]).toEqual([
      4, 3, 1,
    ]);
    expect(paymentTypeOf('check')).toBeNull();
  });
});

describe('the Morning client', () => {
  it('gets a token once and sends it as a bearer', async () => {
    const fetch = vi.fn(async (url) =>
      url.endsWith('/account/token')
        ? new Response(JSON.stringify({ token: 'tok', expires: 1 }))
        : new Response(JSON.stringify({ id: 'x' })),
    );
    const client = morningClient({
      fetch,
      environment: 'sandbox',
      credentials: { id: 'a', secret: 'b' },
    });
    await client.addClient({ name: 'n' });
    await client.getDocument('d/1');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toBe(`${MORNING_URLS.sandbox}/account/token`);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ id: 'a', secret: 'b' });
    expect(fetch.mock.calls[2][0]).toBe(`${MORNING_URLS.sandbox}/documents/d%2F1`);
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer tok');
  });

  it('turns the provider error into a readable one', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ errorCode: 1003, errorMessage: 'Bad tax id' }), {
          status: 400,
        }),
    );
    const client = morningClient({ fetch, credentials: { id: 'a', secret: 'b' } });
    await expect(client.addClient({})).rejects.toThrow('Morning: Bad tax id');
  });

  it('refuses to call without keys', async () => {
    const client = morningClient({ fetch: vi.fn(), credentials: { id: null, secret: null } });
    await expect(client.addDocument({})).rejects.toMatchObject({ code: 'provider_keys' });
  });
});

describe('handle', () => {
  it('is for platform administrators only', async () => {
    const db = fakeDb({ invoice: openInvoice, lines, customer, provider });
    const morning = fakeMorning();
    expect(
      (await handle(post('/issue', { invoice_id: ID }, 'user-jwt'), deps(db, morning))).status,
    ).toBe(403);
    expect((await handle(post('/issue', { invoice_id: ID }, null), deps(db, morning))).status).toBe(
      403,
    );
    expect(db.claim).not.toHaveBeenCalled();
    expect((await handle(post('/issue', { invoice_id: 'x' }), deps(db, morning))).status).toBe(400);
  });

  it('issues a tax invoice, creates the client once and records the document', async () => {
    const db = fakeDb({ invoice: openInvoice, lines, customer, provider });
    const morning = fakeMorning();
    const response = await handle(post('/issue', { invoice_id: ID }), deps(db, morning));
    expect(response.status).toBe(200);
    expect(db.claim).toHaveBeenCalledWith(ID, 'invoice');
    expect(morning.addClient).toHaveBeenCalledTimes(1);
    expect(db.updateCustomer).toHaveBeenCalledWith('c1', { provider_client_id: 'client-1' });
    expect(morning.addDocument.mock.calls[0][0]).toMatchObject({
      type: 305,
      client: { id: 'client-1' },
    });
    expect(db.updateInvoice).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        official_state: 'done',
        official_type: 305,
        official_id: 'doc-1',
        official_number: 20001,
        official_url: 'https://morning.example/doc-he',
        official_amount: 637.2,
        official_error: null,
      }),
    );
  });

  it("flags a total that differs from the provider's", async () => {
    const db = fakeDb({ invoice: openInvoice, lines, customer, provider });
    const morning = fakeMorning({ getDocument: vi.fn(async () => ({ amount: 637.19 })) });
    await handle(post('/issue', { invoice_id: ID }), deps(db, morning));
    expect(db.updateInvoice.mock.calls.at(-1)[1]).toMatchObject({
      official_error: 'amount_mismatch',
    });
  });

  it('passes the claim refusal on, and marks a provider failure for a retry', async () => {
    const busy = fakeDb({ error: 'busy' });
    const refused = await handle(post('/issue', { invoice_id: ID }), deps(busy, fakeMorning()));
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.code).toBe('busy');

    const db = fakeDb({
      invoice: openInvoice,
      lines,
      customer: { ...customer, provider_client_id: 'k' },
      provider,
    });
    const morning = fakeMorning({
      addDocument: vi.fn(async () => {
        throw Object.assign(new Error('Morning: Bad tax id'), {
          status: 502,
          code: 'provider_error',
        });
      }),
    });
    const failed = await handle(post('/issue', { invoice_id: ID }), deps(db, morning));
    expect(failed.status).toBe(502);
    expect(morning.addClient).not.toHaveBeenCalled();
    expect(db.updateInvoice).toHaveBeenCalledWith(ID, {
      official_state: 'failed',
      official_error: 'Morning: Bad tax id',
    });
  });

  it('releases the claim when the provider is off or the payment method is unknown', async () => {
    const off = fakeDb({
      invoice: openInvoice,
      lines,
      customer,
      provider: { ...provider, enabled: false },
    });
    expect(
      (await handle(post('/issue', { invoice_id: ID }), deps(off, fakeMorning()))).status,
    ).toBe(409);
    expect(off.updateInvoice).toHaveBeenCalledWith(ID, {
      official_state: null,
      official_error: 'provider_disabled',
    });

    const cheque = fakeDb({
      invoice: { ...openInvoice, status: 'paid', paid_at: '2026-11-05', payment_method: 'check' },
      lines,
      customer,
      provider,
    });
    const morning = fakeMorning();
    const response = await handle(post('/issue', { invoice_id: ID }), deps(cheque, morning));
    expect((await response.json()).error.code).toBe('payment_method');
    expect(morning.addDocument).not.toHaveBeenCalled();
  });

  it('issues a linked receipt for a paid bill', async () => {
    const invoice = {
      ...openInvoice,
      status: 'paid',
      paid_at: '2026-11-05',
      official_id: 'doc-1',
      official_type: 305,
    };
    const db = fakeDb({
      invoice,
      lines,
      customer: { ...customer, provider_client_id: 'k' },
      provider,
    });
    const morning = fakeMorning({
      addDocument: vi.fn(async () => ({ id: 'rec-1', number: 30001, url: { he: 'r' } })),
    });
    expect((await handle(post('/receipt', { invoice_id: ID }), deps(db, morning))).status).toBe(
      200,
    );
    expect(morning.addDocument.mock.calls[0][0]).toMatchObject({
      type: 400,
      linkedDocumentIds: ['doc-1'],
    });
    expect(db.updateInvoice).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ receipt_state: 'done', receipt_number: 30001 }),
    );
  });

  it("makes a payment page whose notification carries the bill's token", async () => {
    const db = fakeDb({ invoice: openInvoice, lines, customer, provider });
    const morning = fakeMorning();
    const response = await handle(post('/payment-link', { invoice_id: ID }), deps(db, morning));
    expect(await response.json()).toEqual({ url: 'https://secure.cardcom.example/pay' });
    const form = morning.paymentForm.mock.calls[0][0];
    expect(form).toMatchObject({
      type: 320,
      amount: 637.2,
      maxPayments: 3,
      custom: ID,
      client: { id: 'client-1' },
    });
    const notifyUrl = new URL(form.notifyUrl);
    expect(notifyUrl.pathname).toBe('/functions/v1/billing-documents/notify');
    expect(notifyUrl.searchParams.get('token')).toBe(openInvoice.payment_token);

    const off = fakeDb({
      invoice: openInvoice,
      lines,
      customer,
      provider: { ...provider, clearing: false },
    });
    expect(
      (await (await handle(post('/payment-link', { invoice_id: ID }), deps(off, morning))).json())
        .error.code,
    ).toBe('clearing_disabled');
  });
});

describe('the payment notification', () => {
  const notifyRequest = (token, id = 'doc-9') =>
    new Request(`${BASE}/notify?invoice=${ID}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id, external_data: ID, document_id: '60009' }).toString(),
    });
  const loaded = {
    invoice: openInvoice,
    customer: { ...customer, provider_client_id: 'client-1' },
    provider,
  };

  it('refuses a wrong token without asking the provider', async () => {
    const db = fakeDb(null, { loadForNotify: vi.fn(async () => loaded) });
    const morning = fakeMorning();
    expect((await handle(notifyRequest('wrong'), deps(db, morning))).status).toBe(403);
    expect(morning.getDocument).not.toHaveBeenCalled();
    expect(safeEqual('', '')).toBe(false);
  });

  it('checks the document with the provider before marking the bill paid', async () => {
    const good = {
      id: 'doc-9',
      type: 320,
      number: 40001,
      amount: 637.2,
      client: { id: 'client-1' },
      url: { he: 'u' },
    };
    for (const [doc, status] of [
      [{ ...good, type: 305 }, 409],
      [{ ...good, amount: 1 }, 409],
      [{ ...good, client: { id: 'someone-else' } }, 409],
      [good, 200],
    ]) {
      const db = fakeDb(null, { loadForNotify: vi.fn(async () => loaded) });
      const morning = fakeMorning({ getDocument: vi.fn(async () => doc) });
      const response = await handle(notifyRequest(openInvoice.payment_token), deps(db, morning));
      expect(response.status).toBe(status);
      if (status === 200) {
        expect(db.updateInvoice).toHaveBeenCalledWith(
          ID,
          expect.objectContaining({
            status: 'paid',
            paid_at: '2026-11-09',
            payment_method: 'card',
            official_type: 320,
            official_number: 40001,
          }),
        );
      } else {
        expect(db.updateInvoice).not.toHaveBeenCalled();
      }
    }
  });

  it('answers a repeated notification without recording twice', async () => {
    const db = fakeDb(null, {
      loadForNotify: vi.fn(async () => ({
        ...loaded,
        invoice: { ...openInvoice, official_id: 'doc-9' },
      })),
    });
    const response = await handle(
      notifyRequest(openInvoice.payment_token),
      deps(db, fakeMorning()),
    );
    expect(await response.json()).toEqual({ ok: true, already: true });
    expect(db.updateInvoice).not.toHaveBeenCalled();
  });
});
