import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// OPS-06: a pool vehicle is booked, approved by a manager and returned with its odometer.
test('a pool vehicle is booked, approved and returned', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager', full_name: 'דנה' },
        permissions: ['vehicles.read', 'pool.manage'],
      },
    },
    rpc: { fleet_features: ['pool'] },
    tables: {
      vehicles: [
        { id: 'v1', org_id: 'o1', plate_number: '12-345-67', pool: true },
        { id: 'v2', org_id: 'o1', plate_number: '76-543-21', pool: false },
      ],
      pool_bookings: [],
      profiles: [{ id: 'p1', org_id: 'o1', full_name: 'דנה' }],
    },
  });
  await gotoReady(page, '/fleet/pool');
  await page.getByRole('button', { name: 'הזמנת רכב' }).click();
  const dialog = page.getByRole('dialog', { name: 'הזמנת רכב' });
  await dialog.getByLabel('יעד').fill('חיפה');
  await dialog.getByRole('button', { name: 'שליחת בקשה' }).click();
  await expect.poll(() => fleet.tables.pool_bookings.length).toBe(1);
  expect(fleet.tables.pool_bookings[0]).toMatchObject({ vehicle_id: 'v1', destination: 'חיפה' });

  // The fake database does not run the trigger: the request is shown as the server would store it.
  fleet.tables.pool_bookings[0].status = 'requested';
  fleet.tables.pool_bookings[0].requested_by = 'p1';
  await page.reload();
  await page.getByRole('button', { name: 'אישור' }).click();
  await expect.poll(() => fleet.tables.pool_bookings[0].status).toBe('approved');
  await page.getByRole('button', { name: 'החזרת הרכב' }).click();
  const back = page.getByRole('dialog', { name: 'החזרת הרכב' });
  await back.getByLabel('מד ק"מ בהחזרה').fill('45210');
  await back.getByRole('button', { name: 'החזרת הרכב' }).click();
  await expect.poll(() => fleet.tables.pool_bookings[0].status).toBe('returned');
  expect(fleet.tables.pool_bookings[0]).toMatchObject({
    return_odometer_km: 45210,
    return_check_ok: true,
  });

  // The manager marks another vehicle as a pool vehicle.
  await page.getByRole('button', { name: 'רכבי המאגר: 76-543-21' }).click();
  await expect.poll(() => fleet.tables.vehicles[1].pool).toBe(true);
});
