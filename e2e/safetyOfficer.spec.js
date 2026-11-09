import { test, expect, gotoReady } from './fixtures';

const FLEET = 'https://viper-fleet-api.srv2122641.hstgr.cloud';
const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

const mockFleet = async (page, { role = 'safety_officer', permissions = [], tables = {} }) => {
  const calls = [];
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o1', role },
          permissions,
        },
      });
    }
    const name = url.pathname.split('/').at(-1);
    if (request.method() !== 'GET' || url.pathname.includes('/rpc/')) {
      calls.push({ name, method: request.method(), body: request.postDataJSON() });
      return route.fulfill({ status: 201, json: {} });
    }
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    const rows = tables[name] || [];
    if (single) {
      return rows.length
        ? route.fulfill({ json: rows[0] })
        : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
    }
    return route.fulfill({ json: rows });
  });
  return calls;
};

test('the work plan lists what is due and opens an investigation with its template', async ({
  page,
}) => {
  await mockFleet(page, {
    permissions: ['safety.read', 'safety.write'],
    tables: {
      drivers: [
        {
          id: 'd1',
          full_name: 'דנה לוי',
          status: 'active',
          is_professional: true,
          traccar_driver_id: 1,
        },
      ],
      safety_reviews: [
        {
          id: 'r1',
          driver_id: 'd1',
          kind: 'periodic',
          held_at: isoDay(-100),
          driver_signed_at: null,
        },
      ],
      driver_license_checks: [
        { driver_id: 'd1', checked_at: isoDay(-170), next_check_at: isoDay(10) },
      ],
      incidents: [
        {
          id: 'i1',
          number: 17,
          type: 'accident',
          occurred_at: new Date().toISOString(),
          driver_id: 'd1',
        },
      ],
      organizations: [{ name: 'הובלות הצפון בע"מ' }],
    },
  });
  await gotoReady(page, '/fleet/safety-officer');

  const meeting = page.getByRole('row', { name: /שיחה תקופתית/ });
  await expect(meeting).toContainText('באיחור');
  await expect(meeting).toContainText('הנהג עוד לא חתם');
  await expect(page.getByRole('row', { name: /בדיקת רישיון/ })).toContainText('עוד 10 ימים');

  await page.getByRole('button', { name: /באיחור · 1/ }).click();
  await expect(page.getByRole('row', { name: /בדיקת רישיון/ })).toHaveCount(0);
  await page.getByRole('button', { name: /הכול · 3/ }).click();

  await page
    .getByRole('row', { name: /תחקיר תאונה/ })
    .getByRole('button', { name: 'כתיבת תחקיר' })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('סיכום')).toContainText('הגורמים הישירים וגורמי השורש');
  await dialog.getByRole('button', { name: 'ביטול' }).click();

  const [report] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'דוח רבעוני' }).click(),
  ]);
  await expect(report.locator('h1')).toContainText('דוח קצין בטיחות לבעל העסק');
  await expect(report.locator('body')).toContainText('הובלות הצפון בע"מ');
  await expect(report.locator('body')).toContainText('חתימת בעל העסק');
  await report.close();
});

test('a driver signs the meeting summary in the driver area', async ({ page }) => {
  const calls = await mockFleet(page, {
    role: 'driver',
    permissions: ['inspections.write'],
    tables: {
      drivers: [{ id: 'd1', full_name: 'דנה לוי' }],
      safety_reviews: [
        {
          id: 'r1',
          kind: 'periodic',
          held_at: isoDay(-2),
          summary: 'שיחה על מהירות בכביש 6',
          decisions: null,
        },
      ],
      safety_procedures: [
        { id: 'sp1', title: 'נוהל נהיגה בטוחה', version: '2', document_path: null },
      ],
    },
  });
  await gotoReady(page, '/driver');
  await expect(page.getByText('שיחה על מהירות בכביש 6')).toBeVisible();
  await expect(page.getByText('נוהל נהיגה בטוחה · 2')).toBeVisible();
  const sign = page.getByRole('button', { name: 'חתימה' });
  await expect(sign).toBeDisabled();
  await page.getByLabel('שם מלא').fill('דנה לוי');
  await sign.click();
  await expect.poll(() => calls.some((call) => call.name === 'safety_review_sign')).toBe(true);
  expect(calls.find((call) => call.name === 'safety_review_sign').body).toEqual({
    p_id: 'r1',
    p_name: 'דנה לוי',
  });
});

test('a work order warns about a garage that is not licensed', async ({ page }) => {
  await mockFleet(page, {
    role: 'manager',
    permissions: ['maintenance.read', 'maintenance.write'],
    tables: {
      vendors: [
        { id: 'g1', name: 'מוסך הצפון', type: 'garage', licensed: false, active: true },
        { id: 'g2', name: 'מוסך מורשה', type: 'garage', licensed: true, active: true },
      ],
    },
  });
  await gotoReady(page, '/fleet/work-order');
  await page.getByRole('combobox', { name: 'ספק' }).click();
  await page.getByRole('option', { name: 'מוסך הצפון' }).click();
  await expect(page.getByText('המוסך הזה לא מורשה')).toBeVisible();
  await page.getByRole('combobox', { name: 'ספק' }).click();
  await page.getByRole('option', { name: 'מוסך מורשה' }).click();
  await expect(page.getByText('המוסך הזה לא מורשה')).toHaveCount(0);
});
