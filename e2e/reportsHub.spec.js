import { test, expect, gotoReady } from './fixtures';

test('reports open on a page grouped by question and remember the last ones', async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, '/');
  // The rail has links; the phone's tab bar has buttons.
  await page
    .getByRole(isMobile ? 'button' : 'link', { name: 'דוחות', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/reports$/);
  for (const group of ['פעילות ושימוש', 'התנהגות ובטיחות', 'מיקומים ואזורים', 'כלים']) {
    await expect(page.getByRole('heading', { name: group })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'נפתחו לאחרונה' })).toHaveCount(0);

  await page
    .getByRole('region', { name: 'פעילות ושימוש' })
    .getByRole('link', { name: /נסיעות/ })
    .click();
  await expect(page).toHaveURL(/\/reports\/trips/);
  // The visit is noted once the report has mounted.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('recentReports')))
    .toContain('trips');
  await page.goto('/reports');
  const recent = page.getByRole('region', { name: 'נפתחו לאחרונה' });
  await expect(recent.getByRole('link', { name: /נסיעות/ })).toBeVisible();
});
