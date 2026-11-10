import { test, expect, gotoReady } from './fixtures';

// REP-09: the trips report compares its tiles with the period before.
test('the trips tiles show the change from the previous period', async ({ page }) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000 - 1);
  await page.route('**/api/reports/trips?*', (route) => {
    const start = Date.parse(new URL(route.request().url()).searchParams.get('from'));
    const today = start >= from.getTime();
    const trip = (distance) => ({
      deviceId: 1,
      startTime: new Date(start + 3600000).toISOString(),
      endTime: new Date(start + 5400000).toISOString(),
      distance,
      duration: 1800000,
      averageSpeed: 20,
      maxSpeed: 30,
    });
    return route.fulfill({ json: today ? [trip(12000), trip(12000)] : [trip(20000)] });
  });
  await gotoReady(
    page,
    `/reports/trips?deviceId=1&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
  );
  await page.getByLabel('השוואה לתקופה הקודמת').check();
  await page.getByRole('button', { name: 'הצג' }).first().click();
  // Two trips against one (and twice the time); 24 km against 20.
  await expect(page.getByText('▲ 100% מהתקופה הקודמת')).toHaveCount(2);
  await expect(page.getByText('▲ 20% מהתקופה הקודמת')).toBeVisible();
});
