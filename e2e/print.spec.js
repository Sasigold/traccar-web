import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

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
  await expect(header).toContainText('SYNC POINT / REPORT');
  await expect(header).toContainText('נסיעות');
  await expect(header).toContainText(/Delivery Van · 12-345-67/);
  await expect(header).toContainText('הופק על ידי');
  await expect(header.locator('svg').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'שמירת תצוגה' })).toBeHidden();
});

// BRD-08: documents share the report's printed header, labelled and on portrait pages.
test('the driver file prints with the shared document header', async ({ page }) => {
  await writeMode(page);
  await page.route('**/api/drivers/7', (route) =>
    route.fulfill({ json: { id: 7, name: 'Dana Levi', uniqueId: 'D7', attributes: {} } }),
  );
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['safety.read'],
      },
    },
    tables: { drivers: [] },
  });
  await gotoReady(page, '/fleet/driver-file/7');
  const header = page.locator('.vf-print-header');
  await expect(header).toHaveAttribute('data-page', 'document');
  await page.emulateMedia({ media: 'print' });
  await expect(header).toBeVisible();
  await expect(header).toContainText('SYNC POINT / DRIVER FILE');
  await expect(header).toContainText('Dana Levi');
  await expect(header.locator('svg').first()).toBeVisible();
});
