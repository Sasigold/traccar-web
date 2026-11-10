import { test, expect, gotoReady } from './fixtures';

// REP-11: the row shown on the map is marked and stays in view.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('the stop shown on the map is marked and in view', async ({ page }) => {
  await gotoReady(page, `/reports/stops?deviceId=3&${day()}`);
  const rows = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'הצגה במפה' }) });
  await expect(rows.first()).toBeVisible();
  const row = rows.last();
  await row.getByRole('button', { name: 'הצגה במפה' }).click();
  const selected = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'הסרה מהמפה' }) });
  await expect(selected).toBeInViewport();
  const bar = await selected
    .locator('td')
    .first()
    .evaluate((cell) => getComputedStyle(cell).borderInlineStartWidth);
  expect(bar).toBe('3px');
});
