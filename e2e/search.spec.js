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
      await dialog.getByRole('textbox').fill('לוי');
      const option = dialog.getByRole('button', { name: /Delivery Van/ });
      await expect(option).toBeVisible();
      await expect(option.locator('mark')).toHaveText('לוי');
      const { violations } = await axe(page).include('[role=dialog]').analyze();
      expect(formatViolations(violations)).toBe('');
      await option.click();
      await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toBeVisible();
    });
  }
});
