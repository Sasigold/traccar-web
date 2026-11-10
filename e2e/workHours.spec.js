import { test, expect, gotoReady } from './fixtures';

// OPS-05: each driver's working days from the first to the last ignition.
test('work hours by driver from the trips', async ({ page }) => {
  const day = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();
  await page.route('**/api/reports/trips?*', (route) =>
    route.fulfill({
      json: [
        { deviceId: 1, driverUniqueId: 'drv1', startTime: day(8, 7), endTime: day(8, 8) },
        { deviceId: 1, driverUniqueId: 'drv1', startTime: day(8, 15), endTime: day(8, 16, 30) },
      ],
    }),
  );
  const from = encodeURIComponent(new Date(2026, 10, 8).toISOString());
  const to = encodeURIComponent(new Date(2026, 10, 9).toISOString());
  await gotoReady(page, `/reports/work-hours?deviceId=1&from=${from}&to=${to}`);
  const row = page
    .getByRole('row')
    .filter({ hasText: /9:30|9\.5/ })
    .first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('1');
});
