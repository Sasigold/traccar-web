import { test, expect, gotoReady } from './fixtures';

// REP-16: the dashboard prints with the shared document header, without the screen's controls.
test('the dashboard prints with its name, period and who printed it', async ({ page }) => {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => {
      window.printed += 1;
    };
  });
  await gotoReady(page, '/dashboard');
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await page.getByRole('menuitem', { name: 'הדפסה / PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);

  await page.emulateMedia({ media: 'print' });
  const header = page.locator('.vf-print-header');
  await expect(header).toBeVisible();
  await expect(header).toContainText('SYNC POINT / DASHBOARD');
  await expect(header).toContainText('תפעול');
  await expect(header).toContainText('היום');
  await expect(page.getByRole('combobox', { name: 'תקופה' })).toBeHidden();
});
