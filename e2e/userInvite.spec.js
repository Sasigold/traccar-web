import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// ADM-16: a new user gets a link to set a password, and the raw Traccar flags wait under
// "Advanced".
test('a new user is invited by e-mail instead of a typed password', async ({ page }) => {
  await writeMode(page);
  await page.route('**/api/server', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    return route.fulfill({ response, json: { ...(await response.json()), emailEnabled: true } });
  });
  await gotoReady(page, '/settings/user');

  const advanced = page.getByRole('button', { name: /מתקדם: הרשאות ומגבלות/ });
  await expect(advanced).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('מגבלת רכבים')).toBeHidden();
  await advanced.click();
  await expect(page.getByLabel('מגבלת רכבים')).toBeVisible();

  await expect(page.getByLabel('שליחת קישור להגדרת סיסמה')).toBeChecked();
  await expect(page.getByLabel('סיסמה', { exact: true })).toHaveCount(0);
  await page.getByLabel('שם', { exact: true }).fill('נועה כהן');
  await page.getByLabel('אימייל', { exact: true }).fill('noa@demo.invalid');

  const created = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/users'),
  );
  const reset = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/password/reset'),
  );
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  const body = (await created).postDataJSON();
  expect(body.password).toMatch(/^[A-Za-z0-9]{24,}$/);
  expect((await reset).postData()).toBe('email=noa%40demo.invalid');
  await expect(page.getByText('נשלח קישור להגדרת סיסמה אל noa@demo.invalid')).toBeVisible();
});
