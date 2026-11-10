import { test, expect, gotoReady } from './fixtures';

// BRD-03: motion says that something happened. No endless decorative loop on the main screens
// (the loader and the route progress bar are the only animations allowed to repeat).
const endless = (page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
      .map((animation) => animation.effect?.target)
      .filter((target) => target && !target.closest('.vf-loader, [role="progressbar"]'))
      .map((target) => `${target.tagName}.${target.className?.baseVal ?? target.className}`),
  );

for (const path of ['/', '/dashboard', '/telemetry/6', '/settings/devices']) {
  test(`no endless decorative animation on ${path}`, async ({ page }) => {
    await gotoReady(page, path);
    await page.waitForTimeout(1500);
    expect(await endless(page)).toEqual([]);
  });
}

test('a page change fades in once', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the section menu is a drawer on phones');
  await gotoReady(page, '/settings/devices');
  await page
    .getByRole('navigation', { name: 'תוקפים והתראות' })
    .getByRole('link', { name: 'תוקפים' })
    .click();
  const fades = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.target?.id === 'main-content').length,
  );
  expect(fades).toBeLessThanOrEqual(1);
  await expect(page).toHaveURL(/\/fleet\/expiries/);
});
