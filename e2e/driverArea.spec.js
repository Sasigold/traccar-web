import { Buffer } from 'node:buffer';
import { test, expect, gotoReady, FLEET } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// A driver linked to the demo's Delivery Van (device 1).
const tables = {
  drivers: [{ id: 'd1', full_name: 'דנה לוי', traccar_driver_id: 1 }],
  current_assignments: [
    { driver_id: 'd1', vehicle_id: 'veh1', traccar_device_id: 1, plate_number: '12-345-67' },
  ],
  safety_event_reviews: [
    {
      id: 'sr1',
      category: 'hardBraking',
      occurred_at: '2026-11-08T07:30:00Z',
      traccar_device_id: 1,
      note: 'בלימה חדה ליד הצומת',
    },
  ],
  inspection_templates: [
    {
      id: 'tpl1',
      name: 'בדיקה יומית',
      inspection_template_items: [
        { id: 'it1', label: 'צמיגים', type: 'pass_fail', critical: true, sort_order: 0 },
      ],
    },
  ],
};

// `net.down` drops every write (no signal); `net.storageDown` only the photo uploads.
const mockFleet = async (page, net = {}) => {
  const writes = [];
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o1', role: 'driver' },
          permissions: ['incidents.write', 'inspections.write'],
        },
      });
    }
    const name = url.pathname.split('/').at(-1);
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    if (
      request.method() !== 'GET' &&
      (net.down || (net.storageDown && url.pathname.includes('/storage/v1/')))
    ) {
      return route.abort('internetdisconnected');
    }
    if (url.pathname.includes('/storage/v1/')) {
      writes.push({ name: 'storage', path: url.pathname });
      return route.fulfill({ json: { Key: url.pathname } });
    }
    if (request.method() !== 'GET') {
      writes.push({ name, body: request.postDataJSON() });
      return route.fulfill({ status: 201, json: single ? { id: `${name}-1` } : [] });
    }
    const rows = tables[name] || [];
    if (single) {
      return rows.length
        ? route.fulfill({ json: rows[0] })
        : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
    }
    return route.fulfill({ json: rows });
  });
  return writes;
};

test('a driver lands in the driver area and sends a morning check for their own vehicle', async ({
  page,
}) => {
  const writes = await mockFleet(page);
  await gotoReady(page, '/');
  await expect(page).toHaveURL(/\/driver$/);

  await page.getByRole('link', { name: 'בדיקת בוקר' }).click();
  await expect(page).toHaveURL(/\/driver\/check$/);
  await expect(page.getByText('12-345-67')).toBeVisible();
  // Nobody asks the driver who they are or which vehicle they drive.
  await expect(page.getByLabel('נהג')).toHaveCount(0);
  await expect(page.getByLabel('רכב')).toHaveCount(0);

  await page
    .getByRole('group', { name: 'צמיגים' })
    .getByRole('button', { name: 'תקין', exact: true })
    .click();
  await page.getByRole('button', { name: 'שליחת הבדיקה' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'הבדיקה נשלחה' })).toBeVisible();
  const inspection = writes.find((write) => write.name === 'inspections');
  expect(inspection.body).toMatchObject({ vehicle_id: 'veh1', driver_id: 'd1', result: 'pass' });

  await page.getByRole('link', { name: 'חזרה לאזור הנהג' }).click();
  await expect(page).toHaveURL(/\/driver$/);
});

test('a damage report starts with the camera and needs no manager fields', async ({ page }) => {
  const writes = await mockFleet(page);
  await gotoReady(page, '/driver/damage');
  await expect(page.getByText('רכב 12-345-67 · דנה לוי')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles({
    name: 'damage.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(page.getByRole('img', { name: 'תמונה 1' })).toBeVisible();
  await page.getByRole('button', { name: 'המשך' }).click();

  const next = page.getByRole('button', { name: 'המשך' });
  await expect(next).toBeDisabled();
  await page.getByRole('button', { name: 'נזק', exact: true }).click();
  await page.getByRole('group', { name: 'יש פצועים?' }).getByRole('button', { name: 'לא' }).click();
  await expect(page.getByLabel('אשמה')).toHaveCount(0);
  await next.click();

  await page
    .getByRole('group', { name: 'היה מעורב רכב או אדם נוסף?' })
    .getByRole('button', { name: 'לא' })
    .click();
  await page.getByRole('button', { name: 'שליחת הדיווח' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'הדיווח נשלח' })).toBeVisible();

  const incident = writes.find((write) => write.name === 'incidents');
  expect(incident.body).toMatchObject({
    vehicle_id: 'veh1',
    driver_id: 'd1',
    type: 'damage',
    injuries: false,
  });
  expect(writes.some((write) => write.name === 'storage')).toBe(true);
  expect(writes.find((write) => write.name === 'incident_photos').body).toMatchObject({
    incident_id: incident.body.id,
    file_name: 'damage.jpg',
  });
});

// ADM-10: with no signal the report waits in the phone, and goes once the signal is back.
const fillDamage = async (page) => {
  await page.locator('input[type=file]').setInputFiles({
    name: 'damage.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('button', { name: 'נזק', exact: true }).click();
  await page.getByRole('group', { name: 'יש פצועים?' }).getByRole('button', { name: 'לא' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page
    .getByRole('group', { name: 'היה מעורב רכב או אדם נוסף?' })
    .getByRole('button', { name: 'לא' })
    .click();
  await page.getByRole('button', { name: 'שליחת הדיווח' }).click();
};

test('with no signal the report waits in the phone and goes later, once', async ({ page }) => {
  const net = { down: false };
  const writes = await mockFleet(page, net);
  await gotoReady(page, '/driver/damage');
  await expect(page.getByText('רכב 12-345-67 · דנה לוי')).toBeVisible();
  net.down = true;
  await fillDamage(page);
  await expect(page.getByRole('status').filter({ hasText: 'הדיווח נשמר בטלפון' })).toBeVisible();
  expect(writes.filter((write) => write.name === 'incidents')).toHaveLength(0);

  await page.getByRole('link', { name: 'חזרה לאזור הנהג' }).click();
  await expect(page.getByText('ממתין לשליחה (1)')).toBeVisible();
  net.down = false;
  await page.getByRole('button', { name: 'לשלוח עכשיו' }).click();
  await expect(page.getByText('ממתין לשליחה (1)')).toHaveCount(0);
  expect(writes.filter((write) => write.name === 'incidents')).toHaveLength(1);
  expect(writes.filter((write) => write.name === 'incident_photos')).toHaveLength(1);
});

test('photos that did not upload are sent again without a second report', async ({ page }) => {
  const net = { storageDown: true };
  const writes = await mockFleet(page, net);
  await gotoReady(page, '/driver/damage');
  await expect(page.getByText('רכב 12-345-67 · דנה לוי')).toBeVisible();
  await fillDamage(page);
  await expect(page.getByRole('alert').filter({ hasText: '1 תמונות לא עלו' })).toBeVisible();
  net.storageDown = false;
  await page.getByRole('button', { name: 'שליחה חוזרת של התמונות' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'הדיווח נשלח' })).toBeVisible();
  expect(writes.filter((write) => write.name === 'incidents')).toHaveLength(1);
  expect(writes.filter((write) => write.name === 'incident_photos')).toHaveLength(1);
});

// ADM-11: the first check creates the daily checklist; a failed critical item needs a photo and
// a comment, and ends with "do not drive".
test('a failed critical item stops the driver, with a photo and a comment', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'driver' },
        permissions: ['incidents.write', 'inspections.write'],
      },
    },
    tables: {
      drivers: [{ id: 'd1', full_name: 'דנה לוי', traccar_driver_id: 1, profile_id: 'p1' }],
      current_assignments: tables.current_assignments,
    },
    rpc: {
      inspection_default_template: (body, state) => {
        state.tables.inspection_templates = [
          { id: 'tpl-default', name: 'בדיקת בוקר', active: true },
        ];
        state.tables.inspection_template_items = [
          {
            id: 'i1',
            template_id: 'tpl-default',
            inspection_template_id: 'tpl-default',
            label: 'בלמים',
            type: 'pass_fail',
            critical: true,
            sort_order: 0,
          },
          {
            id: 'i2',
            template_id: 'tpl-default',
            inspection_template_id: 'tpl-default',
            label: 'צופר',
            type: 'pass_fail',
            critical: false,
            sort_order: 1,
          },
        ];
        return 'tpl-default';
      },
    },
  });

  await gotoReady(page, '/driver/check');
  await expect(page.getByRole('group', { name: 'בלמים' })).toBeVisible();
  await expect(page.getByText('נותרו 2 סעיפים למילוי')).toBeVisible();

  // "All OK", then the brakes fail.
  await page.getByRole('button', { name: 'הכול תקין' }).click();
  await expect(page.getByText(/נותרו/)).toHaveCount(0);
  await page.getByRole('group', { name: 'בלמים' }).getByRole('button', { name: 'לא תקין' }).click();
  await expect(page.getByText(/סעיף קריטי נכשל/)).toBeVisible();
  await expect(page.getByText('נותרו 1 סעיפים למילוי')).toBeVisible();

  await page.getByRole('button', { name: 'שליחת הבדיקה' }).click();
  expect(fleet.tables.inspections || []).toHaveLength(0);
  await page.getByLabel('מה הבעיה').fill('הדוושה רכה');
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'brakes.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAQH/rM3H5AAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
  await page.getByRole('button', { name: 'שליחת הבדיקה' }).click();
  await expect(page.getByText('אין לצאת לנסיעה.')).toBeVisible();
  expect(fleet.tables.inspections[0]).toMatchObject({ result: 'fail', driver_id: 'd1' });
  expect(fleet.tables.issues[0]).toMatchObject({ severity: 'critical', title: 'בלמים' });
  expect([...fleet.files.keys()][0]).toMatch(/^o1\/inspections\/.*brakes\.png$/);
});

// SAF-01: an event the manager sent for a self-review: what happened, one question, understood.
test('the driver answers a self-review in 30 seconds', async ({ page }) => {
  const writes = await mockFleet(page);
  await gotoReady(page, '/driver');
  const card = page.getByRole('heading', { name: 'לבדיקה עצמית (1)' });
  await expect(card).toBeVisible();
  await expect(page.getByText('בלימה חדה ליד הצומת')).toBeVisible();
  const done = page.getByRole('button', { name: 'הבנתי' });
  await expect(done).toBeDisabled();
  await page.getByRole('radio', { name: 'טעות שלי, אשים לב' }).check();
  await done.click();
  await expect
    .poll(() => writes.find((write) => write.name === 'safety_driver_ack')?.body)
    .toEqual({ p_id: 'sr1', p_answer: 'my_mistake' });
});

// SAF-02: the QR in the cabin opens the check-in; the database checks the code.
test('the driver checks in to a vehicle from its QR link', async ({ page }) => {
  const writes = await mockFleet(page);
  await gotoReady(page, '/driver/checkin?d=1&c=abc123');
  await expect(page.getByRole('status').filter({ hasText: 'נרשמתם לרכב' })).toBeVisible();
  expect(writes.find((write) => write.name === 'driver_check_in').body).toEqual({
    p_device: 1,
    p_code: 'abc123',
  });
});
