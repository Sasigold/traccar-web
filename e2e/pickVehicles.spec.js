import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// LIV-25: pick several vehicles in the list and act on them together.
test('picking vehicles shows a count, picks all shown and ends with Done', async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByRole('button', { name: 'בחירת כמה רכבים' }).click();
  const bar = page.getByRole('toolbar', { name: 'פעולות על הרכבים שנבחרו' });
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 0');

  const rows = page.locator('[aria-pressed]').filter({ hasText: /Courier|Van|Truck/ });
  await rows.first().click();
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 1');
  // A click while picking picks; it doesn't open the vehicle's card.
  await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');

  await bar.getByRole('button', { name: 'בחירת כל המוצגים' }).click();
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 6');
  await expect(bar.getByRole('button', { name: 'העברה לקבוצה' })).toBeEnabled();
  await bar.getByRole('button', { name: 'ניקוי הבחירה' }).click();
  await expect(bar.getByRole('status')).toHaveText('נבחרו: 0');

  await bar.getByRole('button', { name: 'סיום הבחירה' }).click();
  await expect(bar).toHaveCount(0);
});

// LIV-25: Shift + drag on the map picks the vehicles in the box; one command to all of them.
test('an area on the map picks its vehicles, and a command goes to all of them', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Shift + drag is a desktop gesture');
  await writeMode(page);
  const sent = [];
  await page.route('**/api/commands/send', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {} });
  });
  await page.route('**/api/commands/types?*', (route) =>
    route.fulfill({ json: [{ type: 'positionSingle' }, { type: 'engineStop' }] }),
  );
  await gotoReady(page, '/');
  await page.getByRole('button', { name: 'בחירת כמה רכבים' }).click();
  const bar = page.getByRole('toolbar', { name: 'פעולות על הרכבים שנבחרו' });
  await page.getByRole('button', { name: 'כל הצי' }).click();
  await page.waitForTimeout(1500);
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(bar.getByRole('status')).not.toHaveText('נבחרו: 0');

  await bar.getByRole('button', { name: 'שליחת פקודה' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: /עצירת מנוע/ })).toHaveCount(0);
  await dialog.getByRole('radio').first().click();
  await dialog.getByRole('button', { name: /שליחה ל-\d+ רכבים/ }).click();
  await expect(dialog).toBeHidden();
  expect(sent.length).toBeGreaterThan(0);
  expect(new Set(sent.map((command) => command.deviceId)).size).toBe(sent.length);
});
