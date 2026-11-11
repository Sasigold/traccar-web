import { Buffer } from 'node:buffer';
import { test, expect, gotoReady, FLEET } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

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
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
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

test('the positions report refuses a file download that would include hidden locations', async ({
  page,
}) => {
  const now = Date.now();
  await mockFleet(page, {
    tables: {
      privacy_private_periods: [
        {
          traccar_device_id: 1,
          started_at: new Date(now - 15 * MINUTE).toISOString(),
          ended_at: new Date(now - 10 * MINUTE).toISOString(),
        },
      ],
    },
  });
  const downloads = [];
  page.on('request', (request) => {
    if (/\/api\/positions\/(csv|gpx|kml|kmz)/.test(request.url())) downloads.push(request.url());
  });
  const from = new Date(now - 60 * MINUTE).toISOString();
  const to = new Date(now).toISOString();
  await gotoReady(page, `/reports/route?deviceId=1&from=${from}&to=${to}`);
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await page.getByRole('menuitem', { name: 'ייצוא (CSV)' }).click();
  await expect(page.getByText(/אי אפשר להוריד אותם כקובץ/)).toBeVisible();
  expect(downloads).toEqual([]);
});

// SEC-12: an employee's data, exported and erased from the privacy page.
test('an employee’s data is exported, then erased after typing the name', async ({ page }) => {
  await writeMode(page);
  const driver = { id: 'd1', full_name: 'יוסי כהן', status: 'active', erased_at: null };
  const fleet = await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'admin' }, permissions: ['privacy.manage'] },
    },
    tables: { drivers: [driver], organizations: [{ id: 'o1', name: 'הובלות הצפון' }] },
    rpc: {
      privacy_subject_export: (body) => ({ driver: { id: body.p_driver, full_name: 'יוסי כהן' } }),
      privacy_erase_driver: () => ({
        files: [{ bucket: 'documents', path: 'o1/drivers/licence.pdf' }],
        tables: { documents: 1 },
      }),
    },
  });
  fleet.files.set('o1/drivers/licence.pdf', { type: 'application/pdf', body: Buffer.from('x') });

  await gotoReady(page, '/fleet/privacy');
  await page.getByLabel('עובד').click();
  await page.getByRole('option', { name: 'יוסי כהן' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ייצוא הנתונים של העובד' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^viper-fleet_employee-data_d1_\d{4}-\d{2}-\d{2}\.json$/,
  );

  await page.getByRole('button', { name: 'מחיקת הפרטים האישיים' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'מחיקה סופית' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill('יוסי');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill('יוסי כהן');
  await confirm.click();
  await expect(page.getByText('הפרטים האישיים נמחקו, יחד עם 1 קבצים.')).toBeVisible();
  // The database erased the rows; the app removed the file from storage.
  expect(fleet.removedFiles).toEqual(['o1/drivers/licence.pdf']);
  const rpcs = fleet.requests.filter((request) => request.path.includes('/rpc/privacy_'));
  expect(rpcs.map((request) => request.path.split('/').pop())).toEqual([
    'privacy_subject_export',
    'privacy_erase_driver',
  ]);
});

// SEC-17: the owner finds the files no record points to and deletes them through Storage.
test('files no record points to are found and deleted', async ({ page }) => {
  await writeMode(page);
  const orphans = Array.from({ length: 120 }, (_, index) => ({
    name: `o1/expenses/orphan-${index}.pdf`,
    size: 1024 * 1024,
    created_at: '2026-09-01T10:00:00Z',
  }));
  const fleet = await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'owner' }, permissions: ['privacy.manage'] },
    },
    rpc: { fleet_orphan_files: orphans },
    tables: { privacy_policies: [], privacy_notices: [], drivers: [] },
  });
  await gotoReady(page, '/fleet/privacy');
  await page.getByRole('button', { name: 'חיפוש קבצים כאלה' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נמצאו 120 קבצים' })).toContainText(
    '120 MB',
  );
  await page.getByRole('button', { name: 'מחיקת 120 הקבצים' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'הסרה' }).click();
  await expect(page.getByRole('status').filter({ hasText: '120 קבצים נמחקו' })).toBeVisible();
  // In two requests of at most 100 paths.
  expect(fleet.removedFiles).toHaveLength(120);
  expect(fleet.requests.filter((request) => request.method === 'DELETE')).toHaveLength(2);
});
