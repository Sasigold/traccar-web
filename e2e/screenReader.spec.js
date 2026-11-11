import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// A11-08: windows have names, a chosen vehicle is said, tables are named, and the calendar
// moves with the arrow keys (mirrored right to left).
test('the search window has a name, and choosing a vehicle is said', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Ctrl+K is a keyboard shortcut');
  await gotoReady(page, '/');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'חיפוש או מעבר מהיר…' })).toBeVisible();
  await page.keyboard.type('Delivery');
  await page.keyboard.press('Enter');
  await expect(page.locator('[aria-live="polite"]')).toContainText('נבחר: Delivery Van');
});

test('a report table is named after its page', async ({ page }) => {
  await gotoReady(page, '/reports/stops');
  const table = page.getByRole('table').first();
  await expect(table).toHaveAttribute('aria-labelledby', 'page-title');
});

test('the calendar moves by day with the arrows, right to left', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/driver/1');
  const expiry = page.getByLabel('תוקף רישיון');
  const [day, month, year] = (await expiry.inputValue()).split('/');
  await expiry
    .locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]')
    .getByRole('button', { name: 'פתיחת לוח שנה' })
    .click();
  const selected = page.locator(`[data-day="${year}-${month}-${day}"]`);
  await selected.focus();
  // In Hebrew the next day is to the left.
  await page.keyboard.press('ArrowLeft');
  const next = new Date(Number(year), Number(month) - 1, Number(day) + 1);
  const pad = (n) => String(n).padStart(2, '0');
  await expect(
    page.locator(
      `[data-day="${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}"]`,
    ),
  ).toBeFocused();
});
