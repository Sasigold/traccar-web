import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ISR-05: the vehicle card estimates the monthly taxable benefit from the list price.
test('the vehicle card shows the monthly benefit of a car with a list price', async ({ page }) => {
  await writeMode(page);
  // This test's own demo sandbox: the car gets a list price and a hybrid engine.
  const device = await (await page.request.get('/api/devices/1')).json();
  await page.request.put('/api/devices/1', {
    data: {
      ...device,
      attributes: { ...device.attributes, listPrice: 200000, fuelType: 'hybrid' },
    },
  });
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['vehicles.read'] },
    },
    tables: {},
  });
  await gotoReady(page, '/fleet/vehicle/1');
  await expect(page.getByText('שווי שימוש לחודש')).toBeVisible();
  // 200,000 × 2.48% − 560 (hybrid) = 4,400.
  await expect(page.getByText(/4,400/)).toBeVisible();
});
