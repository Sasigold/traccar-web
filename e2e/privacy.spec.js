import { test, expect, gotoReady, FLEET } from './fixtures';

const MINUTE = 60 * 1000;

// A companion database with the privacy tables. `tables` answers GET by table name; every write
// and RPC is recorded in `calls`.
const mockFleet = async (page, { role = 'owner', permissions = [], tables = {} }) => {
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
      return route.fulfill({ status: name === 'privacy_private_set' ? 200 : 201, json: {} });
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

test('a vehicle in private mode leaves the live map and its card says why', async ({
  page,
  isMobile,
}) => {
  const calls = await mockFleet(page, {
    tables: {
      privacy_private_periods: [
        {
          traccar_device_id: 1,
          started_at: new Date(Date.now() - 60 * MINUTE).toISOString(),
          ended_at: null,
        },
      ],
    },
  });
  await gotoReady(page, '/');
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByText('Delivery Van').first().click();
  await expect(page.getByText('המיקום מוסתר: הנהג הפעיל מצב פרטי.')).toBeVisible();
  // No position, so nothing on the card points at a place.
  await expect(page.getByRole('link', { name: /Google|Apple/ })).toHaveCount(0);
  await expect.poll(() => calls.some((call) => call.name === 'privacy_log_view')).toBe(true);
  expect(calls.find((call) => call.name === 'privacy_log_view').body).toMatchObject({
    p_device_ids: [1],
    p_view: 'live',
  });
});

test('replay leaves out the private part of the route and records the view', async ({ page }) => {
  const now = Date.now();
  const calls = await mockFleet(page, {
    tables: {
      privacy_private_periods: [
        {
          traccar_device_id: 1,
          // The demo's history is the last 20 minutes: hide five of them.
          started_at: new Date(now - 15 * MINUTE).toISOString(),
          ended_at: new Date(now - 10 * MINUTE).toISOString(),
        },
      ],
    },
  });
  const from = new Date(now - 60 * MINUTE).toISOString();
  const to = new Date(now).toISOString();
  await gotoReady(page, `/replay?deviceId=1&from=${from}&to=${to}`);
  await expect(page.getByRole('note')).toContainText('מיקומים הוסתרו לפי מדיניות הפרטיות');
  await expect(page.getByRole('button', { name: 'ייצוא' })).toBeDisabled();
  const log = calls.find((call) => call.name === 'privacy_log_view');
  expect(log.body).toMatchObject({ p_device_ids: [1], p_view: 'replay' });
});

test('the privacy page saves the working hours and publishes the notice', async ({ page }) => {
  const calls = await mockFleet(page, {
    permissions: ['privacy.manage'],
    tables: { drivers: [{ id: 'd1', full_name: 'דנה לוי', status: 'active' }] },
  });
  await gotoReady(page, '/fleet/privacy');
  await page.getByLabel('הסתרת המיקום מחוץ לשעות העבודה').check();
  await page.getByRole('button', { name: 'ו׳' }).click();
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נשמר' })).toBeVisible();
  const policy = calls.find((call) => call.name === 'privacy_policies');
  expect(policy.body).toMatchObject({
    org_id: 'o1',
    hide_outside_hours: true,
    work_days: [0, 1, 2, 3, 4, 5],
    work_start: '07:00',
  });

  await expect(page.getByLabel('נוסח ההודעה')).toContainText('הודעה לעובדים על איסוף מיקום הרכב');
  await page.getByRole('button', { name: 'פרסום ההודעה' }).click();
  await expect.poll(() => calls.some((call) => call.name === 'privacy_notices')).toBe(true);
  expect(calls.find((call) => call.name === 'privacy_notices').body).toMatchObject({ version: 1 });
});

test('a driver agrees to the notice and turns private mode on', async ({ page }) => {
  const calls = await mockFleet(page, {
    role: 'driver',
    permissions: ['inspections.write'],
    tables: {
      drivers: [{ id: 'd1', full_name: 'דנה לוי' }],
      current_assignments: [{ driver_id: 'd1', traccar_device_id: 1, plate_number: '12-345-67' }],
      privacy_notices: [{ version: 2, body: 'נוסח ההודעה לבדיקה', published_at: '2026-11-01' }],
    },
  });
  await gotoReady(page, '/driver');
  await expect(page.getByText('נוסח ההודעה לבדיקה')).toBeVisible();
  await page.getByRole('button', { name: 'קראתי והסכמתי' }).click();
  await expect.poll(() => calls.some((call) => call.name === 'privacy_consents')).toBe(true);
  expect(calls.find((call) => call.name === 'privacy_consents').body).toMatchObject({
    driver_id: 'd1',
    notice_version: 2,
    method: 'portal',
  });

  await page.getByLabel('מצב פרטי').click();
  await expect.poll(() => calls.some((call) => call.name === 'privacy_private_set')).toBe(true);
  expect(calls.find((call) => call.name === 'privacy_private_set').body).toEqual({ p_on: true });
});
