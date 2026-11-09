import { test, expect, gotoReady, axe, formatViolations } from './fixtures';

// The demo server answers commands for online vehicles after two seconds.
test.describe('commands from the vehicle card', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await gotoReady(page, '/');
    if (isMobile) {
      await page.getByRole('button', { name: 'רשימת רכבים' }).click();
    }
    await page.getByText('Delivery Van').first().click();
    await page.getByRole('button', { name: 'פקודה', exact: true }).click();
  });

  test('engine stop asks for the plate number and the card follows the reply', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /שליחת פקודה/ });
    await expect(dialog).toBeVisible();
    // The map stays where it was: no jump to the settings page.
    await expect(page).toHaveURL(/\/$/);

    await dialog.getByRole('radio', { name: 'דומם מנוע' }).click();
    const send = dialog.getByRole('button', { name: 'דומם מנוע' });
    await expect(send).toBeDisabled();
    const confirm = dialog.getByRole('textbox', { name: /לאישור, הקלידו את מספר הרישוי/ });
    await confirm.fill('1234566');
    await expect(send).toBeDisabled();
    // Separators do not count.
    await confirm.fill('1234567');
    await expect(send).toBeEnabled();

    const results = await axe(page).include('[role=dialog]').analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);

    await send.click();
    await expect(dialog).toBeHidden();
    const status = page.getByRole('status').filter({ hasText: 'דומם מנוע' });
    await expect(status).toContainText('engineStop: OK');

    await status.getByRole('button', { name: 'הסתרת מצב הפקודה' }).click();
    await expect(status).toHaveCount(0);
  });

  test('a harmless command needs no confirmation', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'דיווח חד-פעמי' }).click();
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'דיווח חד-פעמי' })).toContainText(
      'positionSingle: OK',
    );
  });
});
