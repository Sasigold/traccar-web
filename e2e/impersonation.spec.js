import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// SEC-13: "log in as" needs a reason, and the switched session says so with the way back.
test('logging in as another user asks why, shows a banner, and goes back', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/users');
  const row = page.getByRole('row', { name: /דנה לוי/ });
  // Phones fold the row's actions into "more actions".
  const more = row.getByRole('button', { name: 'פעולות נוספות' });
  if (await more.isVisible()) {
    await more.click();
    await page.getByRole('menuitem', { name: 'כניסה' }).click();
  } else {
    await row.getByRole('button', { name: 'כניסה' }).click();
  }

  const dialog = page.getByRole('dialog', { name: 'כניסה בתור דנה לוי' });
  const go = dialog.getByRole('button', { name: 'כניסה' });
  await expect(go).toBeDisabled();
  await dialog.getByLabel('סיבה').fill('בדיקת תקלה בדוח');
  await go.click();

  const banner = page.getByRole('status').filter({ hasText: 'אתם מחוברים בתור דנה לוי' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'חזרה לחשבון שלי' }).click();
  await expect(page).toHaveURL(/\/login/);
});
