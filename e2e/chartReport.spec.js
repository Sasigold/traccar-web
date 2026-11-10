import { test, expect, gotoReady } from './fixtures';

// REP-15: one chart per value with its unit and a round axis from zero, and an export.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('a value per chart, a round axis from zero, and an export', async ({ page }) => {
  await gotoReady(page, `/reports/chart?deviceId=1&${day()}`);
  const speed = page.getByRole('region', { name: 'מהירות' });
  await expect(speed).toBeVisible();
  await expect(speed).toContainText(/\(קמ"ש\)|\(ק"מ\/שעה\)/);
  const labels = speed.locator('.recharts-yAxis-tick-labels text');
  await expect(labels.first()).toBeAttached();
  const ticks = await labels.allTextContents();
  expect(ticks[0]).toBe('0');
  expect(ticks.every((tick) => /^-?\d+$/.test(tick))).toBe(true);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הצג' }).locator('..').getByRole('button').last().click();
  await page.getByRole('menuitem', { name: /XLSX/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
});
