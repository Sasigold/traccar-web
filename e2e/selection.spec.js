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

// LIV-15: single keys: J/K move through the list, R opens today's replay of the selected one.
test('J and K move between vehicles, R opens the replay', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a keyboard on the desktop');
  await gotoReady(page, '/');
  await page.keyboard.press('j');
  const pressed = page.locator('[data-row][aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  const first = await pressed.getAttribute('data-row');
  await page.keyboard.press('j');
  await expect(pressed).not.toHaveAttribute('data-row', first);
  await page.keyboard.press('k');
  await expect(pressed).toHaveAttribute('data-row', first);
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  await page.keyboard.press('r');
  await expect(page).toHaveURL(/\/replay\?deviceId=\d+/);
});
