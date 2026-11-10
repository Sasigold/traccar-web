import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// LIV-30: small fixes in the live list.
test('the list is one tab stop, and the arrows move between rows', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the list is open by default on a desktop');
  await gotoReady(page, '/');
  const rows = page.locator('[data-row]');
  await expect(rows.first()).toBeVisible();
  await expect(page.locator('[data-row][tabindex="0"]')).toHaveCount(1);
  await rows.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-row="1"]')).toBeFocused();
  await expect(page.locator('[data-row="1"]')).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('End');
  const last = (await rows.count()) - 1;
  await expect(page.locator(`[data-row="${last}"]`)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-row="${last}"]`)).toHaveAttribute('aria-pressed', 'true');
});

test('a disabled vehicle says so, and the battery is written', async ({ page, isMobile }) => {
  // The vehicle is disabled in this test's own demo sandbox, so the live updates agree.
  await writeMode(page);
  await gotoReady(page, '/');
  await page.evaluate(async () => {
    const device = await (await fetch('/api/devices/2')).json();
    await fetch('/api/devices/2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...device, disabled: true }),
    });
  });
  await gotoReady(page, '/');
  if (isMobile) await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  const list = page.locator('[data-row]');
  await expect(list.first()).toBeAttached();
  await expect(page.getByRole('img', { name: /^מושבת/ }).first()).toBeAttached();
  await expect(page.getByRole('img', { name: /רמת הסוללה: \d+%/ }).first()).toBeAttached();
});

test('a tap on a quick result picks the vehicle', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the quick results show while the list is closed (a phone)');
  await gotoReady(page, '/');
  const search = page.getByPlaceholder(/חיפוש/).first();
  await search.tap();
  await search.fill('Van');
  const result = page.locator('.MuiPopper-root [data-row]').first();
  await expect(result).toBeVisible();
  await result.tap();
  await expect(page.locator('.MuiPopper-root')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'פעולות נוספות' })).toBeVisible();
});

test('the quick results offer all of them by count, and close on a press outside', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the quick results show while the list is closed (a phone)');
  await gotoReady(page, '/');
  const search = page.getByPlaceholder(/חיפוש/).first();
  await search.tap();
  await expect(page.getByRole('button', { name: /^הצגת כל \d+ התוצאות$/ })).toBeVisible();
  await page.touchscreen.tap(60, 500);
  await expect(page.locator('.MuiPopper-root')).toHaveCount(0);
});
