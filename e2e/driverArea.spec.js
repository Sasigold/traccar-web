import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';

const FLEET = 'https://viper-fleet-api.srv2122641.hstgr.cloud';

// A driver linked to the demo's Delivery Van (device 1).
const tables = {
  drivers: [{ id: 'd1', full_name: 'דנה לוי', traccar_driver_id: 1 }],
  current_assignments: [
    { driver_id: 'd1', vehicle_id: 'veh1', traccar_device_id: 1, plate_number: '12-345-67' },
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

const mockFleet = async (page) => {
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
    incident_id: 'incidents-1',
    file_name: 'damage.jpg',
  });
});
