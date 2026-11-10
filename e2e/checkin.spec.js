import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// SAF-02: a manager prints the vehicle's check-in QR; trips nobody drove show apart.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['vehicles.read', 'vehicles.write'],
};

test('the vehicle page shows the check-in QR to print', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: manager },
    tables: {
      vehicles: [
        {
          id: 'v1',
          org_id: 'o1',
          traccar_device_id: 1,
          plate_number: '12-345-67',
          checkin_code: 'abc123',
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/vehicle/1');
  await page.getByRole('button', { name: "קוד צ'ק-אין לרכב" }).click();
  const dialog = page.getByRole('dialog', { name: "קוד צ'ק-אין לרכב" });
  await expect(dialog.getByRole('img', { name: "קוד צ'ק-אין לרכב" })).toBeVisible();
});

test('the trips report shows the trips with no identified driver', async ({ page }) => {
  // Every other trip loses its identified driver.
  await page.route('**/api/reports/trips?*', async (route) => {
    const response = await route.fetch();
    const trips = await response.json();
    await route.fulfill({
      response,
      json: trips.map((trip, index) =>
        index % 2 ? { ...trip, driverUniqueId: null, driverName: null } : trip,
      ),
    });
  });
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  await gotoReady(
    page,
    `/reports/trips?deviceId=1&deviceId=2&deviceId=3&deviceId=4&deviceId=5&deviceId=6&from=${encodeURIComponent(new Date(from.getTime() - 6 * 86400000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`,
  );
  // Only real rows (the loading placeholders have no text), counted once they stop growing.
  const rows = page.locator('tbody tr').filter({ hasText: /\d/ });
  await expect(rows.first()).toBeVisible();
  let before = 0;
  await expect
    .poll(async () => {
      const count = await rows.count();
      const stable = count === before;
      before = count;
      return stable && count > 1;
    })
    .toBe(true);
  await page.getByRole('combobox', { name: 'נהג' }).click();
  await page.getByRole('option', { name: 'בלי נהג מזוהה' }).click();
  await expect.poll(() => rows.count()).toBeLessThan(before);
});
