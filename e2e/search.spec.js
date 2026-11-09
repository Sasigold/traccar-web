import { test, expect, gotoReady, axe, formatViolations } from './fixtures';

// Demo: "Delivery Van" has plate 12-345-67, driver דנה לוי and is in the group צפון.
test.describe('vehicle search', () => {
  test('the list finds a plate by its digits and marks the match', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the device list is a separate panel on phones');
    await gotoReady(page, '/');
    const input = page.getByPlaceholder('חיפוש לפי שם, לוחית או נהג');
    await input.fill('1234567');
    const rows = page.getByRole('listitem').filter({ has: page.getByRole('button') });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Delivery Van');
    await expect(rows.first().locator('mark')).toHaveText('12-345-67');

    // Final letters do not count: "צפונ" finds the group צפון.
    await input.fill('צפונ');
    await expect(rows.first().locator('mark')).toHaveText('צפון');
    await input.fill('לא קיים');
    await expect(rows).toHaveCount(0);
  });

  for (const mode of ['light', 'dark']) {
    test(`quick search finds a vehicle by its driver (${mode})`, async ({ page }) => {
      await page.addInitScript(
        (value) => localStorage.setItem('themeMode', JSON.stringify(value)),
        mode,
      );
      await gotoReady(page, '/');
      await page.getByRole('button', { name: 'חיפוש או מעבר מהיר…' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox').fill('לוי');
      const option = dialog.getByRole('option', { name: /Delivery Van/ });
      await expect(option).toBeVisible();
      await expect(option.locator('mark')).toHaveText('לוי');
      const { violations } = await axe(page).include('[role=dialog]').analyze();
      expect(formatViolations(violations)).toBe('');
      await option.click();
      await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toBeVisible();
    });
  }
});

// LIV-15: one vehicle found: its actions are right there; "?" lists the shortcuts.
test('a single vehicle in Ctrl+K offers its actions, and "?" lists the shortcuts', async ({
  page,
}) => {
  await gotoReady(page, '/');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  const box = dialog.getByRole('combobox');
  await box.fill('Courier');
  await expect(dialog.getByRole('group', { name: 'פעולות על Courier' })).toBeVisible();
  await expect(box).toHaveAttribute('aria-activedescendant', /command-device-/);
  await dialog.getByRole('option', { name: 'שחזור היום' }).click();
  await expect(page).toHaveURL(/\/replay\?deviceId=4/);

  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'קיצורי מקלדת' })).toBeVisible();
});
