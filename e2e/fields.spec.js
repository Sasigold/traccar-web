import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// ADM-06: Israeli identifiers are checked, normalized and not duplicated.
test('a vehicle plate is checked, formatted and not taken twice', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/device/2');
  const plate = page.getByLabel('מספר רישוי');
  await expect(plate).toHaveAttribute('inputmode', 'numeric');

  await plate.fill('123');
  await plate.blur();
  await expect(page.getByText('מספר רישוי לא תקין: 7 או 8 ספרות')).toBeVisible();
  await expect(page.getByRole('button', { name: 'שמירה' })).toBeDisabled();

  // Delivery Van (device 1) has 12-345-67.
  await plate.fill('1234567');
  await plate.blur();
  await expect(plate).toHaveValue('12-345-67');
  await expect(page.getByText('כבר קיים: Delivery Van')).toBeVisible();

  await plate.fill('7654321');
  await plate.blur();
  await expect(plate).toHaveValue('76-543-21');
  await expect(page.getByText(/כבר קיים/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'שמירה' })).toBeEnabled();
});

test('a driver ID number and phone are checked and normalized', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/driver/2');
  const id = page.getByLabel('תעודת זהות');
  await id.fill('123456789');
  await id.blur();
  await expect(page.getByText('מספר זהות לא תקין')).toBeVisible();
  await id.fill('123456782');
  await id.blur();
  await expect(page.getByText('מספר זהות לא תקין')).toHaveCount(0);

  const phone = page.getByLabel('טלפון');
  await expect(phone).toHaveAttribute('type', 'tel');
  await phone.fill('050-1234567');
  await phone.blur();
  await expect(phone).toHaveValue('+972501234567');
});
