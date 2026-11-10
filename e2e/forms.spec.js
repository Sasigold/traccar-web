import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-24: forms on a phone and with a keyboard.
test('a date can be typed, and a validity renewed by a year', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/device/1');
  const service = page.getByLabel('תוקף שירות המכשיר');
  await service.fill('15032027');
  await expect(service).toHaveValue('15/03/2027');
  await service.press('Enter');
  await expect(service).toHaveValue('15/03/2027');
  await service.fill('31022027');
  await service.press('Tab');
  await expect(page.getByText('התאריך לא תקין', { exact: false })).toBeVisible();

  await gotoReady(page, '/settings/driver/1');
  const expiry = page.getByLabel('תוקף רישיון');
  const before = await expiry.inputValue();
  await expiry
    .locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]')
    .getByRole('button', { name: 'פתיחת לוח שנה' })
    .click();
  await page.getByRole('button', { name: '+שנה' }).click();
  const [day, month, year] = before.split('/');
  await expect(expiry).toHaveValue(`${day}/${month}/${Number(year) + 1}`);
});

test('number fields refuse "e"', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/device/1');
  const year = page.getByLabel('שנת ייצור');
  await year.fill('');
  await year.pressSequentially('20e2+6');
  await expect(year).toHaveValue('2026');
});

test('a form dialog fills the phone, with a file button and shekels', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'full screen is for phones');
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['costs.read', 'costs.write'],
      },
    },
    tables: { expenses: [], fuel_transactions: [], vehicle_costs_monthly: [] },
  });
  await gotoReady(page, '/fleet/costs');
  await page.getByRole('button', { name: 'הוצאות' }).click();
  await page.getByRole('button', { name: 'הוספת הוצאה' }).click();
  const dialog = page.getByRole('dialog');
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(Math.round(box.width)).toBe(viewport.width);
  await expect(dialog.getByRole('button', { name: 'קבלה' })).toBeVisible();
  await expect(dialog.getByText('₪')).toBeVisible();
  await expect(dialog.getByText('כולל מע"מ')).toBeVisible();
});

// ADM-28: a save says what was saved.
test('saving a vehicle names it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the phone list is cards; the message itself is the same');
  await writeMode(page);
  // Opened from the list inside the app, as a user would (saving goes back there).
  await gotoReady(page, '/settings/devices');
  await page
    .getByRole('row', { name: /Delivery Van/ })
    .getByRole('button', { name: 'עריכה' })
    .click();
  await expect(page).toHaveURL(/\/settings\/device\/1$/);
  await page.getByLabel('שם', { exact: true }).fill('Delivery Van 2');
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page.getByText('Delivery Van 2 נשמר')).toBeVisible();
});
