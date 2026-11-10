import process from 'node:process';
import { test, expect, gotoReady } from './fixtures';

// BRD-07: light and dark screenshots of the main screens, desktop and phone, for a look in each
// pull request (CI uploads them). They are pictures to look at, not a comparison; local runs skip
// them unless SCREENS=1.
const PAGES = [
  ['map', '/'],
  ['dashboard', '/dashboard'],
  ['reports', '/reports'],
  ['vehicles', '/settings/devices'],
  ['driver', '/driver'],
];

for (const mode of ['light', 'dark']) {
  test(`screens in ${mode}`, async ({ page }, info) => {
    test.skip(process.env.SCREENS !== '1', 'set SCREENS=1 to take the screenshots');
    test.setTimeout(120_000);
    await page.addInitScript(
      (value) => localStorage.setItem('themeMode', JSON.stringify(value)),
      mode,
    );
    for (const [name, path] of PAGES) {
      await gotoReady(page, path);
      await expect(page.locator('main').first()).toBeVisible();
      // Tiles, charts and fonts settle.
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `screens/${info.project.name}-${mode}-${name}.png` });
    }
  });
}
