import { test, expect, gotoReady } from './fixtures';

// REP-19: editing on a phone can be undone, templates are a gallery, and a dashboard is shared
// as a link that brings a copy.
const widget = (page, title) => page.locator('section[data-widget-id]').filter({ hasText: title });

test('a removed widget comes back with undo, on a phone too', async ({ page }) => {
  await gotoReady(page, '/dashboard');
  await page.locator('[data-widget-id]').first().waitFor();
  await page.getByRole('button', { name: 'התאמה אישית' }).click();
  await expect(page.getByRole('button', { name: 'ביטול פעולה' })).toBeVisible();
  await widget(page, 'מצב חיבור').getByRole('button', { name: 'אפשרויות הרכיב' }).click();
  await page.getByRole('menuitem', { name: 'הסרה' }).click();
  await expect(widget(page, 'מצב חיבור')).toHaveCount(0);
  await page.locator('.MuiSnackbar-root').getByRole('button', { name: 'החזרה' }).click();
  await expect(widget(page, 'מצב חיבור')).toHaveCount(1);
});

test('a share link adds a copy of the dashboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await gotoReady(page, '/dashboard');
  await page.locator('[data-widget-id]').first().waitFor();
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await page.getByRole('menuitem', { name: 'העתקת קישור שיתוף' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/dashboard\?import=[\w-]+$/);

  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await page.getByRole('button', { name: 'הוספה' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page).not.toHaveURL(/import=/);
});

test('templates are offered as a gallery', async ({ page }) => {
  await gotoReady(page, '/dashboard');
  await page.locator('[data-widget-id]').first().waitFor();
  await page.getByRole('button', { name: 'דשבורד חדש' }).click();
  await expect(page.getByRole('menuitem', { name: /בטיחות ונהגים/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /סיכום חודשי להנהלה/ })).toBeVisible();
});
