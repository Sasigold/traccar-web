import { test, expect, gotoReady } from './fixtures';

// BRD-06: small brand details.
const NAVY = '#102C54';

for (const mode of ['light', 'dark']) {
  test(`the browser bar is navy in ${mode} mode`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('themeMode', JSON.stringify(value)),
      mode,
    );
    await gotoReady(page, '/');
    await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /dark/ : /^(?!.*dark)/);
    await expect
      .poll(() => page.locator('meta[name="theme-color"]').getAttribute('content'))
      .toBe(NAVY);
  });
}

test('the phone section menu is a navy drawer with an aqua pill', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the section menu is a drawer on phones');
  await gotoReady(page, '/settings/preferences');
  await page.getByRole('button', { name: 'פתיחת התפריט' }).click();
  const drawer = page.locator('.MuiDrawer-paper');
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    'rgb(16, 44, 84)',
  );
  const current = drawer.locator('.Mui-selected').first();
  expect(await current.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    'rgb(53, 215, 214)',
  );
});

test('the sign-in screen carries the English tagline', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'the brand panel of the sign-in screen is shown on wide screens');
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByText('every vehicle. in sync.')).toBeVisible();
  await context.close();
});
