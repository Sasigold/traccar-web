import { test, expect, gotoReady } from './fixtures';

// LIV-27: stops as a density map, with how many points it shows.
test('the heat map shows the stops of the period', async ({ page }) => {
  await page.route('**/api/reports/stops?*', (route) =>
    route.fulfill({
      json: [0, 1, 2, 3].map((index) => ({
        deviceId: 1,
        latitude: 51.5 + index / 100,
        longitude: -0.12,
        duration: (index + 1) * 600000,
        engineHours: 0,
        startTime: '2026-11-09T08:00:00Z',
        endTime: '2026-11-09T08:30:00Z',
      })),
    }),
  );
  const from = '2026-11-09T00:00:00.000Z';
  const to = '2026-11-09T23:59:59.000Z';
  await gotoReady(page, `/reports/heatmap?deviceId=1&from=${from}&to=${to}`);
  await expect(page.getByRole('status').filter({ hasText: '4 נקודות במפה' })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
