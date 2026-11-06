import { test, expect, axe, formatViolations, gotoReady } from './fixtures';

const pages = [
  ['map', '/'],
  ['reports', '/reports/combined'],
  ['trips report', '/reports/trips'],
  ['preferences', '/settings/preferences'],
  ['devices', '/settings/devices'],
  ['fleet hub', '/fleet'],
  ['validity', '/fleet/expiries?status=all'],
  ['drivers', '/settings/drivers'],
  ['vehicle card', '/settings/device/1'],
  ['driver card', '/settings/driver/2'],
  ['maintenance status', '/settings/maintenances'],
  ['geofences', '/geofences'],
  ['not found', '/no-such-page'],
  ['login', '/login'],
];

for (const [name, path] of pages) {
  test(`${name} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await gotoReady(page, path);
    const { violations } = await axe(page).analyze();
    expect(formatViolations(violations)).toBe('');
  });
}

test('dark mode keeps AA contrast on the map screen', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('themeMode', JSON.stringify('dark')));
  await gotoReady(page, '/');
  const { violations } = await axe(page).withRules(['color-contrast']).analyze();
  expect(formatViolations(violations)).toBe('');
});

test('keyboard users can reach reports from the navigation rail', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones use the bottom tab bar');
  await gotoReady(page, '/');
  const reports = page.getByRole('navigation').first().getByRole('link', { name: 'דוחות' });
  await reports.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/reports/);
  await expect(page.getByRole('link', { name: 'דוחות' }).first()).toHaveAttribute(
    'aria-current',
    'page',
  );
});
