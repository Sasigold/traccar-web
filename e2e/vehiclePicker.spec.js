import { test, expect, gotoReady } from './fixtures';

// REP-05: one picker for vehicles and groups, sized for a real fleet.
const open = async (page) => {
  await page.getByRole('combobox', { name: 'רכבים' }).click();
  return page.getByRole('dialog', { name: 'רכבים' });
};

test('a vehicle is found by its plate digits', async ({ page }) => {
  await gotoReady(page, '/reports/trips');
  const picker = await open(page);
  await picker.getByRole('combobox', { name: 'חיפוש לפי שם, מספר רישוי או מזהה' }).fill('4567890');
  const options = picker.getByRole('option');
  await expect(options.filter({ hasText: 'Courier' })).toBeVisible();
  await expect(options.filter({ hasText: 'Delivery Van' })).toHaveCount(0);
  // The plate is on its own line, left to right.
  await expect(options.filter({ hasText: 'Courier' }).locator('[dir="ltr"]')).toHaveText(
    '45-678-90',
  );
  await options.filter({ hasText: 'Courier' }).click();
  await expect(page).toHaveURL(/deviceId=4/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox', { name: 'רכבים' })).toHaveValue('Courier');
});

test('a whole group, then all of it except one vehicle', async ({ page }) => {
  await gotoReady(page, '/reports/trips');
  const picker = await open(page);
  await picker.getByRole('option', { name: /צפון/ }).click();
  await expect(page).toHaveURL(/groupId=1/);
  await expect(picker.getByRole('status')).toHaveText('3 רכבים · קבוצה אחת');
  await picker.getByRole('option', { name: /Service Van/ }).click();
  await expect(page).not.toHaveURL(/groupId=/);
  await expect(page).toHaveURL(/deviceId=1&deviceId=3|deviceId=3&deviceId=1/);
  await expect(picker.getByRole('option', { name: /Service Van/ })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  await picker.getByRole('button', { name: 'סיום' }).click();
  await expect(page.getByRole('combobox', { name: 'רכבים' })).toHaveValue('2 רכבים');
});

test('the keyboard moves through the list and chooses', async ({ page }) => {
  await gotoReady(page, '/reports/stops');
  await page.getByRole('combobox', { name: 'רכבים' }).focus();
  await page.keyboard.press('Enter');
  const search = page.getByRole('combobox', { name: 'חיפוש לפי שם, מספר רישוי או מזהה' });
  await expect(search).toBeFocused();
  await search.fill('shuttle');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/deviceId=3/);
});

test("the trips report shows one driver's trips", async ({ page }) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  await gotoReady(
    page,
    `/reports/trips?deviceId=1&deviceId=2&deviceId=3&deviceId=4&deviceId=5&deviceId=6&from=${encodeURIComponent(new Date(from.getTime() - 6 * 86400000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`,
  );
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  const field = page.getByRole('combobox', { name: 'נהג' });
  await field.click();
  const options = page.getByRole('option');
  const name = (await options.nth(1).textContent()).trim();
  await options.nth(1).click();
  await expect.poll(() => rows.count()).toBeLessThan(before);
  await expect(field).toHaveValue(name);
});
