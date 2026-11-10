import { test, expect, gotoReady } from './fixtures';

// REP-09: a report view saved under a name opens from the reports page on the current dates of
// its period; the summary compares with the period before.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('a saved view opens from the reports page', async ({ page }) => {
  await gotoReady(page, `/reports/trips?deviceId=1&period=today&${day()}`);
  await page.getByRole('button', { name: 'שמירת תצוגה' }).click();
  const dialog = page.getByRole('dialog', { name: 'שמירת תצוגה' });
  await dialog.getByLabel('שם התצוגה').fill('ואן · היום');
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page.getByText('התצוגה נשמרה בעמוד הדוחות')).toBeVisible();

  await gotoReady(page, '/reports');
  const saved = page
    .getByRole('region', { name: 'תצוגות שמורות' })
    .or(page.locator('section[aria-labelledby="reports-hub-saved"]'));
  await saved.getByRole('link', { name: 'ואן · היום' }).click();
  await expect(page).toHaveURL(/\/reports\/trips\?deviceId=1&period=today&from=.*&to=/);
  await expect(page.getByRole('row').filter({ hasText: 'Delivery Van' }).first()).toBeVisible();
});

test('the summary shows the change from the previous period', async ({ page }) => {
  await page.route('**/api/reports/summary?*', async (route) => {
    const url = new URL(route.request().url());
    const today = Date.parse(url.searchParams.get('from')) >= new Date().setHours(0, 0, 0, 0);
    await route.fulfill({
      json: [
        {
          deviceId: 1,
          distance: today ? 120000 : 100000,
          engineHours: 0,
          maxSpeed: 0,
          averageSpeed: 0,
          spentFuel: 0,
          startTime: url.searchParams.get('from'),
        },
      ],
    });
  });
  await gotoReady(page, `/reports/summary?deviceId=1&${day()}`);
  await page.getByLabel('השוואה לתקופה הקודמת').check();
  await page.getByRole('button', { name: 'הצג' }).first().click();
  await expect(page.getByLabel('שינוי מהתקופה הקודמת: ▲ 20%')).toBeVisible();
});

// REP-09: a saved view also keeps the report's options and its columns.
test('a saved view opens with its columns and options', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('summaryColumns', JSON.stringify(['distance', 'maxSpeed']));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await gotoReady(page, `/reports/summary?deviceId=1&period=today&daily=true&${day()}`);
  await page.getByRole('button', { name: 'שמירת תצוגה' }).click();
  const dialog = page.getByRole('dialog', { name: 'שמירת תצוגה' });
  await dialog.getByLabel('שם התצוגה').fill('מהירות יומית');
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();

  // The columns change after saving; the view brings back its own.
  await page.evaluate(() => localStorage.setItem('summaryColumns', JSON.stringify(['distance'])));
  await gotoReady(page, '/reports');
  await page
    .locator('section[aria-labelledby="reports-hub-saved"]')
    .getByRole('link', { name: 'מהירות יומית' })
    .click();
  await expect(page).toHaveURL(/daily=true/);
  await expect(page).not.toHaveURL(/columns=/);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('summaryColumns'))))
    .toEqual(['distance', 'maxSpeed']);
  await expect(page.getByLabel('עמודות להצגה')).toContainText('מהירות מרבית');
});
