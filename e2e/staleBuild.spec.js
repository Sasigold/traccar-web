import { test, expect, gotoReady } from './fixtures';

// FND-05: a tab opened before a deploy asks for a page file that is gone. It reloads once and
// opens the page instead of showing an error.
test('a page file that fails to load reloads the tab once', async ({ page, isMobile }) => {
  await gotoReady(page, '/');
  let failed = 0;
  await page.route('**/src/reports/ReportsHubPage.jsx*', (route) => {
    if (failed === 0) {
      failed += 1;
      return route.abort();
    }
    return route.continue();
  });
  const reloaded = page.waitForEvent('load');
  await page
    .getByRole(isMobile ? 'button' : 'link', { name: 'דוחות', exact: true })
    .first()
    .click();
  await reloaded;
  expect(failed).toBe(1);
  await expect(page.getByRole('heading', { name: 'פעילות ושימוש' })).toBeVisible();
  await expect(page.getByText('משהו השתבש')).toHaveCount(0);
  expect(await page.evaluate(() => window.sessionStorage.getItem('vfStaleReloadAt'))).toBeTruthy();
});
