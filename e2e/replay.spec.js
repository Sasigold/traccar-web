import { test, expect, gotoReady } from './fixtures';

// LIV-10: the replay by time, with speeds, stops and keys.
test('from a vehicle, today loads at once and the timeline is by time', async ({ page }) => {
  await gotoReady(page, '/replay?deviceId=1');
  await expect(page).toHaveURL(/period=today&from=.*&to=/);
  const timeline = page.getByRole('slider', { name: 'ציר הזמן של המסלול' });
  await expect(timeline).toBeVisible();
  // One element per part of the route, not one per point.
  const parts = await timeline.locator('[data-part]').count();
  const points = Number(await timeline.getAttribute('aria-valuemax')) + 1;
  expect(parts).toBeLessThan(points / 10);

  await timeline.focus();
  await page.keyboard.press('End');
  await expect(timeline).toHaveAttribute('aria-valuenow', String(points - 1));
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(timeline).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('Shift+ArrowRight');
  expect(Number(await timeline.getAttribute('aria-valuenow'))).toBeGreaterThan(1);
});

test('speed and play from the keyboard', async ({ page }) => {
  await gotoReady(page, '/replay?deviceId=1');
  await expect(page.getByRole('slider', { name: 'ציר הזמן של המסלול' })).toBeVisible();
  const speeds = page.getByRole('group', { name: 'מהירות השחזור' });
  await expect(speeds.getByRole('button', { name: '20×' })).toHaveAttribute('aria-pressed', 'true');
  await speeds.getByRole('button', { name: '60×' }).click();
  await expect(speeds.getByRole('button', { name: '60×' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('heading', { name: 'שחזור מסלול' }).click();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'השהיה' })).toBeVisible();
  await page.getByRole('heading', { name: 'שחזור מסלול' }).click();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'הפעלה' })).toBeVisible();
});

test('an empty period is said quietly, and the quick periods load', async ({ page }) => {
  const from = encodeURIComponent('2020-01-01T00:00:00.000Z');
  const to = encodeURIComponent('2020-01-01T01:00:00.000Z');
  await page.route('**/api/positions?*', (route) => route.fulfill({ json: [] }));
  await gotoReady(page, `/replay?deviceId=1&from=${from}&to=${to}`);
  await expect(
    page.getByRole('status').filter({ hasText: 'אין מיקומים בתקופה הזו' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.unroute('**/api/positions?*');
  await page.getByRole('button', { name: 'אתמול' }).click();
  await expect(page).toHaveURL(/period=yesterday/);
});
