import { test, expect, gotoReady } from './fixtures';

// BRD-07: "system" follows the device's light or dark setting, live.
test('the system theme follows the device', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the user menu is on the desktop top bar');
  await page.emulateMedia({ colorScheme: 'light' });
  await gotoReady(page, '/');
  await page.getByRole('button', { name: 'Demo' }).click();
  await page.getByRole('button', { name: 'לפי המערכת' }).click();
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'כהה' }).click();
  await expect(html).toHaveClass(/dark/);
});
