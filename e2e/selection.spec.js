import { test, expect, gotoReady } from './fixtures';

const selectVan = async (page, isMobile) => {
  // The map's layers and controls come once its style has loaded.
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByText('Delivery Van').first().click();
  await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toBeVisible();
};

test.describe('selecting and following a vehicle', () => {
  test('closing the card shows what is followed, and its ✕ clears it', async ({
    page,
    isMobile,
  }) => {
    await gotoReady(page, '/');
    await selectVan(page, isMobile);
    await page.getByRole('button', { name: 'סגירה' }).first().click();
    await expect(page.getByText('עוקבים אחרי Delivery Van')).toBeVisible();
    await page.getByRole('button', { name: 'ביטול הבחירה' }).click();
    await expect(page.getByText('עוקבים אחרי Delivery Van')).toHaveCount(0);
  });

  test('Esc clears the selection, the arrow keys release the camera', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard');
    await gotoReady(page, '/');
    await selectVan(page, isMobile);
    await page.locator('.maplibregl-canvas').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('button', { name: 'חזרה לרכב' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'חזרה לרכב' })).toHaveCount(0);
  });

  test('a click on an empty part of the map clears the selection', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the list panel covers the map on phones');
    await gotoReady(page, '/');
    await selectVan(page, isMobile);
    // Let the camera finish flying to the vehicle first.
    await page.waitForTimeout(1000);
    await page.mouse.click(620, 220);
    await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toHaveCount(0);
  });

  test('"whole fleet" fits the map and clears the selection', async ({ page, isMobile }) => {
    await gotoReady(page, '/');
    await selectVan(page, isMobile);
    if (isMobile) {
      await page.getByRole('button', { name: 'סגירה' }).first().click();
    }
    await page.getByRole('button', { name: 'כל הצי' }).click();
    await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toHaveCount(0);
  });
});
