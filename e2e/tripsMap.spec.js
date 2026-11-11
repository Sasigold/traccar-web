import { test, expect, gotoReady } from './fixtures';

// REP-11: on a desktop the map shows the results before any row is chosen; a row still opens
// its route.
test('the trips map shows the results before a row is chosen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on phones the map opens with a chosen trip');
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000 - 1);
  await gotoReady(
    page,
    `/reports/trips?deviceId=1&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
  );
  await expect(page.getByRole('row').filter({ hasText: 'Delivery Van' }).first()).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
