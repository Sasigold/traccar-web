import { test, expect, gotoReady } from './fixtures';

// LIV-25: pick several vehicles in the list and act on them together.
test('picking vehicles shows a count, picks all shown and ends with Done', async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByRole('button', { name: 'בחירת כמה רכבים' }).click();
  const bar = page.getByRole('toolbar', { name: 'פעולות על הרכבים שנבחרו' });
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 0');

  const rows = page.locator('[aria-pressed]').filter({ hasText: /Courier|Van|Truck/ });
  await rows.first().click();
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 1');
  // A click while picking picks; it doesn't open the vehicle's card.
  await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');

  await bar.getByRole('button', { name: 'בחירת כל המוצגים' }).click();
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 6');
  await expect(bar.getByRole('button', { name: 'העברה לקבוצה' })).toBeEnabled();
  await bar.getByRole('button', { name: 'ניקוי הבחירה' }).click();
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 0');

  await bar.getByRole('button', { name: 'סיום הבחירה' }).click();
  await expect(bar).toHaveCount(0);
});
