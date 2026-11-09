import { test, expect, axe, formatViolations, gotoReady, FLEET } from './fixtures';

const bill = {
  id: 'b3000000-0000-0000-0000-000000000001',
  number: 1042,
  customer_id: 'c1',
  customer_name: 'הובלות הצפון',
  status: 'issued',
  issue_date: '2026-11-01',
  due_date: '2026-12-01',
  period_start: '2026-11-01',
  period_end: '2026-11-30',
  vat_rate: 18,
  subtotal: 540,
  vat_amount: 97.2,
  total: 637.2,
  payment_method: 'transfer',
  is_overdue: false,
};

// A platform administrator with billing rights; the fleet database answers from `state`.
const mockBilling = async (page, state) => {
  await page.route('**/api/session', async (route) => {
    const response = await route.fetch();
    const user = await response.json();
    await route.fulfill({ response, json: { ...user, administrator: true, readonly: false } });
  });
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = request.url();
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    const answer = (row) => route.fulfill({ json: single ? row : [row] });
    if (url.includes('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o0', role: 'owner' },
          permissions: ['customers.read', 'customers.manage', 'billing.read', 'billing.manage'],
        },
      });
    }
    if (url.includes('/functions/v1/billing-documents/issue')) {
      state.calls.push(request.postDataJSON());
      Object.assign(state.bill, {
        official_state: 'done',
        official_type: 305,
        official_id: 'doc-1',
        official_number: 20001,
        official_url: 'https://morning.example/doc',
        official_amount: 637.2,
      });
      return route.fulfill({ json: { official: state.bill } });
    }
    if (url.includes('/rpc/billing_provider_status')) {
      return route.fulfill({ json: [state.keys] });
    }
    if (url.includes('/rpc/billing_set_secret')) {
      const body = request.postDataJSON();
      state.secrets.push(body.p_name);
      state.keys[body.p_name === 'morning_id' ? 'has_id' : 'has_secret'] = true;
      return route.fulfill({ status: 204 });
    }
    if (url.includes('/rest/v1/billing_provider')) {
      if (request.method() === 'POST') {
        state.provider = { ...request.postDataJSON() };
        return route.fulfill({ json: state.provider });
      }
      return state.provider ? answer(state.provider) : route.fulfill({ json: single ? null : [] });
    }
    if (url.includes('/rest/v1/billing_invoices_view')) return answer(state.bill);
    if (url.includes('/rest/v1/billing_invoices?') && request.method() === 'PATCH') {
      state.patches.push(request.postDataJSON());
      return answer({ ...state.bill, ...request.postDataJSON() });
    }
    if (url.includes('/rest/v1/billing_invoice_lines')) {
      return route.fulfill({
        json: [
          {
            id: 'l1',
            invoice_id: bill.id,
            description: 'מנוי',
            quantity: 1,
            unit_price: 540,
            amount: 540,
          },
        ],
      });
    }
    return route.fulfill({ json: [] });
  });
};

test('a platform administrator connects the invoicing provider', async ({ page }) => {
  const state = {
    keys: { has_id: false, has_secret: false },
    secrets: [],
    provider: null,
    bill,
    calls: [],
  };
  await mockBilling(page, state);
  await gotoReady(page, '/admin/invoicing');
  const enable = page.getByLabel('הפקת מסמכים רשמיים פעילה');
  await expect(enable).toBeDisabled();
  const { violations } = await axe(page).analyze();
  expect(formatViolations(violations)).toBe('');

  await page.getByLabel('מזהה המפתח (ID)').fill('key-id');
  await page.getByRole('button', { name: 'שמירת המפתח' }).first().click();
  await page.getByLabel('הסוד (Secret)').fill('key-secret');
  await page.getByRole('button', { name: 'שמירת המפתח' }).last().click();
  await expect(page.getByText('המפתח שמור')).toBeVisible();
  expect(state.secrets).toEqual(['morning_id', 'morning_secret']);
  // The value is not kept on the page once saved.
  await expect(page.getByLabel('הסוד (Secret)')).toHaveValue('');

  await enable.check();
  await page.getByLabel('סביבה').click();
  await page.getByRole('option', { name: 'ניסיון (sandbox)' }).click();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נשמר' })).toBeVisible();
  expect(state.provider).toMatchObject({
    enabled: true,
    environment: 'sandbox',
    provider: 'morning',
  });
});

test('a bill gets its official tax invoice and is then locked', async ({ page }) => {
  const state = {
    keys: { has_id: true, has_secret: true },
    secrets: [],
    provider: {
      id: true,
      provider: 'morning',
      enabled: true,
      environment: 'sandbox',
      clearing: false,
      max_payments: 1,
    },
    bill: { ...bill },
    calls: [],
    patches: [],
  };
  await mockBilling(page, state);
  await gotoReady(page, '/admin/billing');
  await page.getByRole('row', { name: /1042/ }).click();
  const dialog = page.getByRole('dialog');
  const panel = dialog.getByRole('region', { name: 'מסמך רשמי' });
  await expect(dialog.getByRole('button', { name: 'ביטול החשבון' })).toBeVisible();

  await panel.getByRole('button', { name: 'הפקת חשבונית מס' }).click();
  await expect(panel.getByText('חשבונית מס 20001')).toBeVisible();
  await expect(panel.getByRole('link', { name: 'פתיחת המסמך' })).toHaveAttribute(
    'href',
    'https://morning.example/doc',
  );
  expect(state.calls).toEqual([{ invoice_id: bill.id }]);
  // Corrections go through a credit invoice at the provider, not here.
  await expect(dialog.getByRole('button', { name: 'ביטול החשבון' })).toHaveCount(0);
  // Notes can still be saved; nothing else changes.
  await dialog.getByLabel('הערות').fill('שולם בהעברה');
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect.poll(() => state.patches.at(-1)).toEqual({ notes: 'שולם בהעברה' });
  const { violations } = await axe(page).analyze();
  expect(formatViolations(violations)).toBe('');
});
