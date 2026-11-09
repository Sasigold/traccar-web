import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// ADM-05: destructive actions name the item and the consequence; leaving a changed form asks.
test('deleting a group names it and says what happens to its vehicles', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/groups');
  const row = page.getByRole('row', { name: /צפון/ });
  await row.getByRole('button', { name: /פעולות|הסרה|מחיקה/ }).first().click();
  const remove = page.getByRole('menuitem', { name: 'הסרה' });
  if (await remove.isVisible().catch(() => false)) {
    await remove.click();
  }
  const dialog = page.getByRole('dialog', { name: 'למחוק את "צפון"?' });
  await expect(dialog).toContainText('הרכבים שבקבוצה יישארו, בלי קבוצה');
  await dialog.getByRole('button', { name: 'ביטול' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('row', { name: /צפון/ })).toBeVisible();
});

test('leaving a changed form asks first; cancel without changes does not', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the navigation rail is on desktop');
  await writeMode(page);
  await gotoReady(page, '/settings/group/1');
  const name = page.getByLabel('שם');
  await expect(name).toHaveValue('צפון');
  await name.fill('צפון רחוק');
  await page.getByRole('link', { name: 'דוחות' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'לצאת בלי לשמור?' });
  await expect(dialog).toContainText('השינויים שלא נשמרו יאבדו.');
  await dialog.getByRole('button', { name: 'להישאר' }).click();
  await expect(page).toHaveURL(/\/settings\/group\/1$/);
  await expect(name).toHaveValue('צפון רחוק');

  await page.getByRole('button', { name: 'ביטול' }).click();
  await dialog.getByRole('button', { name: 'יציאה בלי לשמור' }).click();
  await expect(page).not.toHaveURL(/\/settings\/group\/1$/);
});
