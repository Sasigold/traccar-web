import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// FND-07: full scenarios that save, against the demo's write mode (demo/sandbox.js) and a fake
// fleet database with a fake traccar-auth (e2e/fakeFleet.js).

const ORG = 'org-north';
const admin = {
  profile: { id: 'p-admin', org_id: ORG, role: 'owner', full_name: 'Demo' },
  permissions: [
    'vehicles.read',
    'vehicles.write',
    'maintenance.read',
    'maintenance.write',
    'incidents.read',
    'incidents.write',
  ],
};

test('a work order is opened, closed, and resets the service counter', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, { users: { 1: admin } });

  await gotoReady(page, '/fleet/work-order?deviceId=1');
  await page.getByLabel('מה עושים').fill('טיפול 15,000');
  await page.getByRole('textbox', { name: 'תיאור' }).first().fill('החלפת שמן');
  await page.getByRole('spinbutton', { name: 'מחיר ליחידה' }).first().fill('450');
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();

  await expect(page).toHaveURL(/\/fleet\/work-orders$/);
  const row = page.getByRole('row', { name: /טיפול 15,000/ });
  await expect(row).toBeVisible();
  // The vehicle row was created from the Traccar card, and the order and its line saved.
  expect(fleet.tables.vehicles).toHaveLength(1);
  expect(fleet.tables.vehicles[0]).toMatchObject({ org_id: ORG, traccar_device_id: 1 });
  const [order] = fleet.tables.work_orders;
  expect(order).toMatchObject({
    org_id: ORG,
    created_by: 'p-admin',
    vehicle_id: fleet.tables.vehicles[0].id,
    title: 'טיפול 15,000',
    status: 'open',
    closed_at: null,
  });
  expect(fleet.tables.work_order_items).toEqual([
    expect.objectContaining({
      work_order_id: order.id,
      description: 'החלפת שמן',
      quantity: 1,
      unit_price: 450,
    }),
  ]);

  // Close it, and reset the oil service counter in Traccar.
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/fleet/work-order/${order.id}$`));
  await page.getByRole('combobox', { name: 'סטטוס' }).click();
  await page.getByRole('option', { name: 'בוצעה' }).click();
  await page.getByRole('checkbox', { name: 'Oil service' }).check();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page).toHaveURL(/\/fleet\/work-orders$/);

  expect(fleet.tables.work_orders[0].status).toBe('done');
  expect(Date.parse(fleet.tables.work_orders[0].closed_at)).toBeGreaterThan(Date.now() - 60000);
  expect(fleet.tables.work_orders[0].traccar_maintenance_id).toBe(1);
  // Lines are replaced as a whole: still one.
  expect(fleet.tables.work_order_items).toHaveLength(1);
  // The next service is counted from the vehicle's odometer now.
  const maintenance = await (await page.request.get('/api/maintenance?deviceId=1')).json();
  const [position] = await (await page.request.get('/api/positions?deviceId=1')).json();
  expect(maintenance[0].start).not.toBe(15000 * 1000);
  expect(Math.abs(maintenance[0].start - position.attributes.totalDistance)).toBeLessThan(5000);

  // Every fleet request went out with this user's token.
  const authorized = fleet.requests.filter((request) => request.path.startsWith('/rest/'));
  expect(authorized.length).toBeGreaterThan(0);
  expect(authorized.every((request) => request.auth === 'Bearer jwt-1')).toBe(true);
});

// A 2×2 PNG, as a phone camera would send a (much larger) one.
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);

test('an incident is reported with a photo, and the photo comes back', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, { users: { 1: admin } });

  await gotoReady(page, '/fleet/incident?deviceId=2');
  await page.getByLabel('מה קרה').fill('פגוש אחורי נפגע בחניה');
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'bumper.png',
    mimeType: 'image/png',
    buffer: PHOTO,
  });
  await expect(page.getByText(/1 תמונ/)).toBeVisible();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page).toHaveURL(/\/fleet\/incidents$/);

  const [incident] = fleet.tables.incidents;
  expect(incident).toMatchObject({
    org_id: ORG,
    reported_by: 'p-admin',
    type: 'accident',
    description: 'פגוש אחורי נפגע בחניה',
  });
  expect(
    fleet.tables.vehicles.find((row) => row.id === incident.vehicle_id).traccar_device_id,
  ).toBe(2);
  // The photo is stored under the organization's incidents folder, drawn again as a JPEG
  // (SEC-17: that drops any GPS position in it).
  const [photo] = fleet.tables.incident_photos;
  expect(photo).toMatchObject({ org_id: ORG, incident_id: incident.id, file_name: 'bumper.png' });
  expect(photo.storage_path).toMatch(new RegExp(`^${ORG}/incidents/[0-9a-f-]{36}-bumper\\.jpg$`));
  const stored = fleet.files.get(photo.storage_path);
  expect(stored.type).toBe('image/jpeg');
  expect([...stored.body.subarray(0, 2)]).toEqual([0xff, 0xd8]);

  // Opening the incident shows the photo, through a signed address.
  await page.getByRole('row', { name: new RegExp(String(incident.number)) }).click();
  const image = page.getByRole('button', { name: 'bumper.png' }).locator('img');
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth))
    .toBe(2);
});

test('another user signing in on the same tab never gets the first user’s fleet data', async ({
  page,
}, testInfo) => {
  await writeMode(page);
  const dana = {
    profile: { id: 'p-dana', org_id: 'org-south', role: 'viewer', full_name: 'דנה לוי' },
    permissions: ['vehicles.read', 'maintenance.read'],
  };
  const fleet = await fakeFleet(page, {
    users: { 1: admin, 2: dana },
    orgScoped: true,
    tables: {
      vehicles: [
        { id: 'v-north', org_id: ORG, traccar_device_id: 1, plate_number: '12-345-67' },
        { id: 'v-south', org_id: 'org-south', traccar_device_id: 3, plate_number: '345-67-890' },
      ],
      work_orders: [
        {
          id: 'w1',
          org_id: ORG,
          number: 7001,
          vehicle_id: 'v-north',
          title: 'צפון: בלמים',
          type: 'repair',
          vendor_id: null,
          total_cost: 0,
          status: 'open',
          opened_at: new Date().toISOString(),
        },
        {
          id: 'w2',
          org_id: 'org-south',
          number: 7002,
          vehicle_id: 'v-south',
          title: 'דרום: צמיגים',
          type: 'tires',
          vendor_id: null,
          total_cost: 0,
          status: 'open',
          opened_at: new Date().toISOString(),
        },
      ],
    },
  });

  await gotoReady(page, '/fleet/work-orders');
  await expect(page.getByRole('row', { name: /צפון: בלמים/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'הזמנת עבודה חדשה' })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('fleetSession')).traccarUserId),
  ).toBe(1);

  // Sign out from the user menu, then Dana signs in on the same tab.
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'עוד' }).click();
    await page.getByRole('button', { name: 'יציאה' }).click();
  } else {
    await page.getByRole('button', { name: 'Demo' }).click();
    await page.getByRole('menuitem', { name: 'יציאה' }).click();
  }
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('fleetSession'))).toBeNull();
  const signedOutAt = fleet.requests.length;

  await page.getByLabel('אימייל').fill('dana@demo.invalid');
  await page.getByRole('textbox', { name: 'סיסמה' }).fill('demo');
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await gotoReady(page, '/fleet/work-orders');

  await expect(page.getByRole('row', { name: /דרום: צמיגים/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /צפון: בלמים/ })).toHaveCount(0);
  // Dana may read work orders but not open new ones.
  await expect(page.getByRole('link', { name: 'הזמנת עבודה חדשה' })).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('fleetSession')).traccarUserId),
  ).toBe(2);

  // After the switch every request carries Dana's token; the first user's is never sent again.
  const after = fleet.requests
    .slice(signedOutAt)
    .filter((request) => request.path.startsWith('/rest/'));
  expect(after.length).toBeGreaterThan(0);
  expect(after.every((request) => request.auth === 'Bearer jwt-2')).toBe(true);
});
