import { test, expect, gotoReady } from './fixtures';

test('a refused save says why in Hebrew and keeps the server text under details', async ({
  page,
}) => {
  // The demo is read-only: every change is refused with 403.
  await gotoReady(page, '/settings/device/1');
  await page.getByRole('button', { name: 'שמירה' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'אין לך הרשאה' }).last();
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText('read-only');
  await alert.getByRole('link', { name: 'יותר פרטים' }).click();
  await expect(page.getByRole('dialog')).toContainText('This demo is read-only.');
});
