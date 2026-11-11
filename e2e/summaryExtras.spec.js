import { test, expect, gotoReady } from './fixtures';

// REP-14: the summary adds active days, litres per 100 km and idling, and draws the distance of
// each day.
test('the summary shows active days, consumption, idling and a daily chart', async ({ page }) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 2);
  const end = new Date(start.getTime() + 3 * 86400000 - 1);
  const dayAt = (offset) =>
    new Date(start.getTime() + offset * 86400000 + 6 * 3600000).toISOString();
  await page.addInitScript(() =>
    localStorage.setItem(
      'summaryColumns',
      JSON.stringify(['distance', 'activeDays', 'fuelPer100', 'idlePercent']),
    ),
  );
  await page.route('**/api/reports/summary?*', (route) => {
    const daily = new URL(route.request().url()).searchParams.get('daily') === 'true';
    return route.fulfill({
      json: daily
        ? [
            { deviceId: 1, startTime: dayAt(0), distance: 60000 },
            { deviceId: 1, startTime: dayAt(1), distance: 0 },
            { deviceId: 1, startTime: dayAt(2), distance: 40000 },
          ]
        : [
            {
              deviceId: 1,
              startTime: start.toISOString(),
              distance: 100000,
              spentFuel: 8,
              engineHours: 4 * 3600000,
              averageSpeed: 0,
              maxSpeed: 0,
            },
          ],
    });
  });
  await page.route('**/api/reports/trips?*', (route) =>
    route.fulfill({ json: [{ deviceId: 1, duration: 3 * 3600000 }] }),
  );
  await gotoReady(
    page,
    `/reports/summary?deviceId=1&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`,
  );
  const row = page.getByRole('row').filter({ hasText: 'Delivery Van' }).first();
  await expect(row).toBeVisible();
  // Two days with distance, 8 L over 100 km, an hour of four standing.
  await expect(row.getByRole('cell').nth(2)).toHaveText('2');
  await expect(row.getByRole('cell').nth(3)).toHaveText('8.0');
  await expect(row.getByRole('cell').nth(4)).toHaveText('25%');
  await expect(page.getByRole('figure', { name: /מרחק ליום/ })).toBeVisible();
});
