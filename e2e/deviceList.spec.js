import { test, expect, gotoReady } from './fixtures';

// LIV-11: what filters the list is always in view, with a count and a way out.
test('a search shows "1 of 6", a chip to remove, and an empty result says how to clear it', async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  const search = page.getByRole('textbox', { name: /חיפוש/ }).first();
  await search.fill('Courier');
  const active = page.getByRole('region', { name: 'מסננים פעילים' });
  await expect(active.getByRole('status')).toHaveText('1 מתוך 6');

  await search.fill('zzzz');
  await expect(page.getByText('אין רכבים שתואמים לסינון')).toBeVisible();
  await page.getByRole('button', { name: 'ניקוי סינון' }).first().click();
  await expect(active).toHaveCount(0);
  await expect(search).toHaveValue('');
});

// LIV-22: the list by group, with headers that count and fold.
test('the list sorted by group has headers that count and fold', async ({ page, isMobile }) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByRole('button', { name: 'סינון' }).first().click();
  await page.getByLabel('מיון לפי').click();
  await page.getByRole('option', { name: 'לפי קבוצה' }).click();
  await page.keyboard.press('Escape');
  const header = page.getByRole('button', { name: /: \d+ רכבים$/ }).first();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  const rowsBefore = await page.locator('[data-row]').count();
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.locator('[data-row]').count()).toBeLessThan(rowsBefore);
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
});
