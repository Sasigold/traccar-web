import { test, expect, gotoReady } from './fixtures';

// REP-09: the stops and events reports compare their tiles with the period before.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000 - 1);
  return {
    from,
    query: `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
  };
};
const isToday = (route, from) =>
  Date.parse(new URL(route.request().url()).searchParams.get('from')) >= from.getTime();

test('the stops tiles show the change from the previous period', async ({ page }) => {
  const { from, query } = day();
  await page.route('**/api/reports/stops?*', (route) => {
    const stop = (minutes) => ({
      deviceId: 1,
      startTime: new Date(from.getTime() + 3600000).toISOString(),
      endTime: new Date(from.getTime() + 3600000 + minutes * 60000).toISOString(),
      duration: minutes * 60000,
      engineHours: 0,
      latitude: 51.5,
      longitude: -0.12,
    });
    return route.fulfill({
      json: isToday(route, from) ? [stop(30), stop(30), stop(30)] : [stop(30), stop(30)],
    });
  });
  await gotoReady(page, `/reports/stops?deviceId=1&${query}`);
  await page.getByLabel('השוואה לתקופה הקודמת').check();
  await page.getByRole('button', { name: 'הצג' }).first().click();
  // Three stops against two, and an hour and a half against an hour.
  await expect(page.getByText('▲ 50% מהתקופה הקודמת')).toHaveCount(2);
});

test('the events tiles show the change from the previous period', async ({ page }) => {
  const { from, query } = day();
  await page.route('**/api/reports/events?*', (route) => {
    const event = (id, type) => ({
      id,
      deviceId: 1,
      type,
      eventTime: new Date(from.getTime() + 3600000).toISOString(),
      attributes: {},
    });
    return route.fulfill({
      json: isToday(route, from)
        ? [event(1, 'deviceOverspeed'), event(2, 'deviceOverspeed'), event(3, 'ignitionOn')]
        : [
            event(4, 'deviceOverspeed'),
            event(5, 'ignitionOn'),
            event(6, 'ignitionOn'),
            event(7, 'ignitionOn'),
          ],
    });
  });
  await gotoReady(page, `/reports/events?deviceId=1&eventType=allEvents&${query}`);
  await page.getByLabel('השוואה לתקופה הקודמת').check();
  await page.getByRole('button', { name: 'הצג' }).first().click();
  // Three events against four; two overspeeds against one.
  await expect(page.getByText('▼ 25% מהתקופה הקודמת')).toBeVisible();
  await expect(page.getByText('▲ 100% מהתקופה הקודמת')).toBeVisible();
});
