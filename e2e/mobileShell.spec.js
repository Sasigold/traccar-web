import { test, expect, gotoReady } from './fixtures';

// LIV-09: the phone shell: five tabs at most, "More" in a sheet, and the card as a bottom sheet.
test.describe('phone shell', () => {
  test.skip(({ isMobile }) => !isMobile, 'phones only');

  test('five tabs at most, the rest in "More", and no menu button', async ({ page }) => {
    await gotoReady(page, '/');
    const tabs = page.getByRole('navigation', { name: 'ניווט' }).getByRole('button');
    expect(await tabs.count()).toBeLessThanOrEqual(5);
    await expect(page.getByRole('button', { name: 'פתיחת התפריט' })).toHaveCount(0);
    // The color theme moved into "More".
    await expect(page.getByRole('banner').getByRole('button', { name: /ממשק/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'עוד' }).click();
    const more = page.getByRole('navigation', { name: 'עוד' });
    await expect(more.getByRole('link', { name: 'הגדרות' })).toBeVisible();
    await expect(more.getByRole('switch', { name: 'ממשק כהה' })).toBeVisible();
    await more.getByRole('button', { name: /שפה/ }).click();
    await expect(more.getByRole('button', { name: 'English' })).toBeVisible();
    await more.getByRole('link', { name: 'הגדרות' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    // A tab's own page has no back arrow.
    await expect(page.getByRole('main').getByRole('button', { name: 'חזרה' })).toHaveCount(0);
  });

  test('the alerts tab opens the alerts', async ({ page }) => {
    await gotoReady(page, '/');
    await page.getByRole('button', { name: /^התראות/ }).click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('complementary')).first(),
    ).toBeVisible();
  });

  test('the vehicle card is a sheet that grows by button and by drag', async ({ page }) => {
    await gotoReady(page, '/');
    await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
    await page.getByText('Delivery Van').first().click();
    const sheet = page.locator('[data-sheet]');
    await expect(sheet).toHaveAttribute('data-sheet', 'peek');
    // The peek has the name and the actions.
    await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toBeVisible();
    const peek = (await sheet.boundingBox()).height;
    expect(peek).toBeLessThan(400);

    await page.getByRole('button', { name: 'הרחבת הכרטיס' }).click();
    await expect(sheet).toHaveAttribute('data-sheet', 'half');
    // Let the sheet finish growing before the drag starts (a slow CI machine measured the title
    // mid-animation and dragged from the wrong place).
    let height = 0;
    await expect
      .poll(async () => {
        const next = (await sheet.boundingBox()).height;
        const settled = Math.abs(next - height) < 1;
        height = next;
        return settled;
      })
      .toBe(true);

    // Drag the title down: back to the peek.
    const title = page.locator('[data-sheet]').getByText('Delivery Van').first();
    const box = await title.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(sheet).toHaveAttribute('data-sheet', 'peek');

    // The close button closes the card, and does not pick another vehicle under it.
    await page.locator('[data-sheet]').getByRole('button', { name: 'סגירה' }).click();
    await expect(page.locator('[data-sheet]')).toHaveCount(0);
  });
});
