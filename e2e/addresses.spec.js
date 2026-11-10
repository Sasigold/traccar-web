import { test, expect, gotoReady } from './fixtures';

// REP-13: all the addresses of a report with one click, three requests at a time.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('"show all addresses" fills every row', async ({ page }) => {
  await page.route('**/api/server', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), geocoderEnabled: true } });
  });
  await page.route('**/api/reports/stops?*', async (route) => {
    const response = await route.fetch();
    const rows = (await response.json()).map((row, index) => ({
      ...row,
      address: null,
      latitude: 32 + index / 100,
      longitude: 34.8,
    }));
    await route.fulfill({
      response,
      json: [...rows, ...rows.map((row) => ({ ...row, startTime: row.endTime }))],
    });
  });
  let active = 0;
  let peak = 0;
  let calls = 0;
  await page.route('**/api/server/geocode?*', async (route) => {
    calls += 1;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 150));
    active -= 1;
    const latitude = new URL(route.request().url()).searchParams.get('latitude');
    await route.fulfill({ body: `רחוב ${latitude}` });
  });
  await gotoReady(page, `/reports/stops?deviceId=3&${day()}`);
  await expect(page.getByRole('link', { name: 'הצג כתובת' }).first()).toBeVisible();
  const links = await page.getByRole('link', { name: 'הצג כתובת' }).count();

  await page.getByRole('button', { name: 'הצגת כל הכתובות' }).click();
  await expect(page.getByRole('link', { name: 'הצג כתובת' })).toHaveCount(0);
  await expect(page.getByText(/^רחוב 32/).first()).toBeVisible();
  // The same point is looked up once, and never more than three at a time.
  expect(calls).toBe(links / 2);
  expect(peak).toBeLessThanOrEqual(3);
  await expect(page.getByRole('button', { name: 'הצגת כל הכתובות' })).toHaveCount(0);
});
