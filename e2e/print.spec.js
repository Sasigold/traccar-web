import { test, expect, gotoReady } from './fixtures';

// REP-16: a printed report says what it is: the report, the period, the vehicles and who
// produced it, under the logo; the filter itself does not print.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('the printed page carries its context', async ({ page }) => {
  await gotoReady(page, `/reports/trips?deviceId=1&${day()}`);
  const header = page.locator('.vf-print-header');
  await expect(header).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(header).toBeVisible();
  await expect(header).toContainText('נסיעות');
  await expect(header).toContainText(/Delivery Van · 12-345-67/);
  await expect(header).toContainText('הופק על ידי');
  await expect(header.locator('svg').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'שמירת תצוגה' })).toBeHidden();
});
