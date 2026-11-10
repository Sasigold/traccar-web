import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-31: the fuel cards screen: the number masked, a new card with its vehicle and limits.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'manager' },
  permissions: ['vehicles.read', 'vehicles.write'],
};

test('a fuel card is added with its vehicle, and shown masked', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same dialog on a phone');
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: manager },
    tables: {
      vehicles: [{ id: 'veh1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' }],
      vehicle_fuel_cards: [],
    },
  });
  await gotoReady(page, '/fleet/fuel-cards');
  await page.getByRole('button', { name: 'כרטיס חדש' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('חברת דלק').click();
  await page.getByRole('option', { name: 'פז' }).click();
  await dialog.getByLabel('מספר כרטיס').fill('7077 1234 5678 9012');
  await dialog.getByLabel('רכב').click();
  await page.getByRole('option', { name: 'Delivery Van' }).click();
  await dialog.getByLabel('מגבלה יומית (ליטר)').fill('80');
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect.poll(() => fleet.tables.vehicle_fuel_cards.length).toBe(1);
  expect(fleet.tables.vehicle_fuel_cards[0]).toMatchObject({
    provider: 'paz',
    card_number: '7077123456789012',
    vehicle_id: 'veh1',
    limit_liters_day: 80,
  });
  await expect(page.getByText('•••• 9012')).toBeVisible();
  await expect(page.getByText('7077123456789012')).toHaveCount(0);
});
