import { test, expect, axe, formatViolations, gotoReady } from './fixtures';

// A11-07: the accessibility statement, linked from the login screen and from settings.
test('the accessibility statement is reachable from the login screen and passes WCAG checks', async ({
  page,
}) => {
  await gotoReady(page, '/login');
  await page.getByRole('link', { name: 'הצהרת נגישות' }).click();
  await expect(page).toHaveURL(/\/accessibility$/);
  await expect(page.getByRole('heading', { level: 1, name: 'הצהרת נגישות' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'מה עוד לא נגיש במלואו' })).toBeVisible();
  // No coordinator in the demo's server settings: the page says so instead of inventing one.
  await expect(page.getByText(/פרטי הרכז יפורסמו כאן/)).toBeVisible();
  const { violations } = await axe(page).analyze();
  expect(formatViolations(violations)).toBe('');
});
