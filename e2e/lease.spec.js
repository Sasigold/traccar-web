import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// ADM-31: a leased vehicle's kilometers against the contract's quota, and the overage ahead.
test('the vehicle card projects a lease over its km quota', async ({ page }) => {
  await writeMode(page);
  const positions = await (await page.request.get('/api/positions?deviceId=1')).json();
  const meters = positions[0]?.attributes?.totalDistance ?? positions[0]?.attributes?.odometer;
  test.skip(typeof meters !== 'number', 'the demo vehicle reports no odometer');
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  // Half the contract gone and 30,000 km driven: 60,000 at this pace, 20,000 over 40,000.
  const device = await (await page.request.get('/api/devices/1')).json();
  await page.request.put('/api/devices/1', {
    data: {
      ...device,
      attributes: {
        ...device.attributes,
        ownership: 'leased',
        leaseStartDate: iso(start),
        leaseEndDate: iso(end),
        leaseStartKm: Math.round(meters / 1000) - 30000,
        leaseKmQuota: 40000,
        leaseExcessRate: 0.5,
      },
    },
  });
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['vehicles.read'] },
    },
    tables: {},
  });
  await gotoReady(page, '/fleet/vehicle/1');
  const card = page.getByRole('region', { name: 'חוזה הליסינג' });
  await expect(card).toContainText('נסעו 30,000 ק"מ מתוך 40,000 ק"מ');
  await expect(card.getByRole('alert')).toContainText(
    /חריגה של 19,\d{3} ק"מ|חריגה של 20,\d{3} ק"מ/,
  );
});

test('the lease fields show for a leased vehicle only', async ({ page }) => {
  await gotoReady(page, '/settings/device/1');
  const quota = page.getByRole('spinbutton', { name: 'מכסת ק"מ לכל החוזה' });
  const ownership = page.getByRole('combobox', { name: 'בעלות' });
  await ownership.click();
  await page.getByRole('option', { name: 'בבעלות' }).click();
  await expect(quota).toHaveCount(0);
  await ownership.click();
  await page.getByRole('option', { name: 'ליסינג' }).click();
  await expect(quota).toBeVisible();
});

// ADM-31: the vehicles that drove today without a morning check.
test('the checks page lists vehicles that drove without a morning check', async ({ page }) => {
  await page.route('**/api/reports/summary?*', (route) =>
    route.fulfill({
      json: [
        { deviceId: 1, distance: 12000 },
        { deviceId: 2, distance: 8000 },
        { deviceId: 3, distance: 0 },
      ],
    }),
  );
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['inspections.read', 'vehicles.read'],
      },
    },
    tables: {
      inspection_templates: [{ id: 't1', name: 'בדיקת בוקר', frequency: 'daily', active: true }],
      vehicles: [
        { id: 'v1', plate_number: '11-111-11', traccar_device_id: 1 },
        { id: 'v2', plate_number: '22-222-22', traccar_device_id: 2 },
        { id: 'v3', plate_number: '33-333-33', traccar_device_id: 3 },
      ],
      inspections: [{ id: 'i1', vehicle_id: 'v2', started_at: new Date().toISOString() }],
    },
  });
  await gotoReady(page, '/fleet/inspections');
  const note = page.getByRole('status').filter({ hasText: 'נסעו היום בלי בדיקת בוקר (1)' });
  await expect(note.getByRole('link', { name: '11-111-11' })).toHaveAttribute(
    'href',
    '/fleet/vehicle/1',
  );
  await expect(note).not.toContainText('22-222-22');
  await expect(note).not.toContainText('33-333-33');
});
