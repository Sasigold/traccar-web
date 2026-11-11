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
