import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// AI-02: the morning's findings beside the map, with the evidence a click away.
// The demo's history changes with the date, so the reports here are fixed: the van drove 20 km
// a day for three weeks and then stood still for five days ("not moving").
const fixedReports = async (page) => {
  await page.route('**/api/reports/summary?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('daily') !== 'true') return route.fallback();
    const from = Date.parse(url.searchParams.get('from'));
    const rows = Array.from({ length: 23 }, (_, day) => ({
      deviceId: 1,
      startTime: new Date(from + day * 86400000 + 8 * 3600000).toISOString(),
      distance: 20000,
      spentFuel: 0,
      engineHours: 3600000,
    }));
    return route.fulfill({ json: rows });
  });
  await page.route('**/api/reports/trips?*', (route) => route.fulfill({ json: [] }));
};

test('the morning findings open, link to their evidence and hide for the day', async ({ page }) => {
  await writeMode(page);
  await fixedReports(page);
  await gotoReady(page, '/');
  const section = page.getByRole('region', { name: 'תובנות הבוקר' });
  const pill = section.getByRole('button', { name: /תובנות הבוקר/ });
  await expect(pill).toBeVisible({ timeout: 15000 });
  await pill.click();
  await expect(pill).toHaveAttribute('aria-expanded', 'true');
  await expect(section.getByRole('heading').first()).toBeVisible();
  await section.getByRole('button', { name: 'הסתרה להיום' }).click();
  await expect(section).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(page.getByRole('region', { name: 'תובנות הבוקר' })).toHaveCount(0);
});

test('a viewer does not get them', async ({ page }) => {
  await gotoReady(page, '/');
  await page.waitForTimeout(4000);
  await expect(page.getByRole('region', { name: 'תובנות הבוקר' })).toHaveCount(0);
});
