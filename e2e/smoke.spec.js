import { test, expect, gotoReady } from './fixtures';

test.describe('first visit', () => {
  test('opens in Hebrew, right to left, even with an English browser', async ({ page }) => {
    await gotoReady(page, '/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await expect(page.getByText('מפה').first()).toBeVisible();
  });

  test('lists the demo fleet with speed in km/h', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the device list is a separate panel on phones');
    await gotoReady(page, '/');
    const rows = page.getByRole('listitem').filter({ has: page.getByRole('button') });
    await expect(rows.first()).toBeVisible();
    await expect(page.getByText(/^\d+ ק"מ\/שעה$/).first()).toBeVisible();
    await expect(page.getByText(/קשר$/)).toHaveCount(0);
  });
});

test.describe('navigation', () => {
  test('reports open with a period filter and a main action', async ({ page }) => {
    await gotoReady(page, '/reports/combined');
    await expect(page.getByRole('combobox', { name: 'תקופה' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'התקופה הקודמת' })).toBeVisible();
  });

  test('settings open', async ({ page }) => {
    await gotoReady(page, '/settings/preferences');
    await expect(page.getByRole('heading', { name: 'העדפות' })).toBeVisible();
  });

  test('an unknown address shows the 404 page with a way back', async ({ page }) => {
    await gotoReady(page, '/this/does/not/exist');
    await expect(page.getByText('404')).toBeVisible();
    await page.getByRole('button', { name: 'חזרה למפה' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('language', () => {
  test('a language that is no longer offered falls back to Hebrew', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('language', JSON.stringify('de')));
    await gotoReady(page, '/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('English is still available and switches to left to right', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('language', JSON.stringify('en')));
    await gotoReady(page, '/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});

test.afterEach(async ({ pageErrors }) => {
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

test.describe('fleet', () => {
  test('validity lists what expired and what expires soon', async ({ page }) => {
    await gotoReady(page, '/fleet/expiries');
    await expect(page.getByRole('row', { name: /12-345-67/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Yossi Cohen/ })).toBeVisible();
    // Valid dates are hidden until "all" is chosen.
    await expect(page.getByRole('row', { name: /567-89-012/ })).toHaveCount(0);
  });

  test('maintenance shows what is left per vehicle', async ({ page }) => {
    await gotoReady(page, '/settings/maintenances');
    await expect(page.getByRole('row', { name: /Oil service/ }).first()).toBeVisible();
  });
});
