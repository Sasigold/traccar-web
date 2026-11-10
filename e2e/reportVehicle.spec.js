import { test, expect, gotoReady } from './fixtures';

// REP-12: a report row names the vehicle and its plate, and a vehicle deleted since does not
// break the report.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('rows show the plate, and "#id" for a deleted vehicle', async ({ page }) => {
  await page.route('**/api/reports/stops?*', async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    const gone = { ...rows[0], deviceId: 999, deviceName: 'gone' };
    await route.fulfill({ response, json: [...rows, gone] });
  });
  await gotoReady(page, `/reports/stops?deviceId=1&${day()}`);
  const row = page.getByRole('row').filter({ hasText: 'Delivery Van' }).first();
  await expect(row).toBeVisible();
  await expect(row.locator('[dir="ltr"]').filter({ hasText: /^\d{2}-\d{3}-\d{2}$/ })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '#999' })).toBeVisible();
});
