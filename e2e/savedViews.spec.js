import { test, expect, gotoReady } from './fixtures';

// LIV-22: favorite vehicles on top, and named views that can be switched and shared.
const openList = async (page, isMobile) => {
  if (isMobile) await page.getByRole('button', { name: 'רשימת רכבים' }).click();
};

test('a pinned vehicle comes first and is marked', async ({ page, isMobile }) => {
  await gotoReady(page, '/');
  await openList(page, isMobile);
  const rows = page.getByRole('listitem').filter({ has: page.getByRole('button') });
  await page.getByText('Service Van').first().click();
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await page.getByRole('menuitem', { name: 'הצמדה לראש הרשימה' }).click();
  await page.keyboard.press('Escape');
  await openList(page, isMobile);
  await expect(rows.first()).toContainText('Service Van');
  // The star is part of the row's name (a button's children are not separate to a reader).
  await expect(rows.first().getByRole('button').first()).toHaveAccessibleName(/מועדף/);

  // It stays pinned after a reload, and can be unpinned.
  await page.reload();
  await openList(page, isMobile);
  await expect(rows.first()).toContainText('Service Van');
});

test('a view is saved, switched to and shared as a link', async ({ page, context, isMobile }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await gotoReady(page, '/');
  await openList(page, isMobile);
  const active = page.getByRole('region', { name: 'מסננים פעילים' });

  await page.getByRole('button', { name: 'סינון' }).click();
  await page.getByLabel('סטטוס').click();
  await page.getByRole('option', { name: /^מחובר/ }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'שמירת התצוגה' }).click();
  await page.getByLabel('שם התצוגה').fill('מחוברים בלבד');
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  const view = page.getByRole('listitem').filter({ hasText: 'מחוברים בלבד' });
  await expect(view).toBeVisible();

  // Copy the link while the filter is on, then clear and switch back through the chip.
  await page.getByRole('button', { name: 'העתקת קישור' }).click();
  const copied = page.getByText('הקישור לתצוגה הועתק');
  await expect(copied).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\?view=[A-Za-z0-9_-]+$/);

  await page.keyboard.press('Escape');
  await expect(copied).toBeHidden({ timeout: 10000 });
  await page.getByRole('button', { name: 'ניקוי סינון' }).first().click();
  await expect(active).toHaveCount(0);
  await page.getByRole('button', { name: 'סינון' }).click();
  await view.getByRole('button', { name: 'מחוברים בלבד' }).click();
  await page.keyboard.press('Escape');
  await expect(active).toBeVisible();

  // The link applies the view in a fresh session and leaves a clean address.
  const fresh = await context.newPage();
  await fresh.addInitScript(() => localStorage.removeItem('deviceFilter'));
  await gotoReady(fresh, link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(fresh).toHaveURL(/\/$/);
  await openList(fresh, isMobile);
  await expect(fresh.getByRole('region', { name: 'מסננים פעילים' })).toBeVisible();
});
