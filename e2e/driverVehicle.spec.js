import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-17: one link between a driver and a vehicle, from either side. A vehicle someone else
// has is moved only when that is confirmed, and the driver's own user then sees it on the map.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'manager' },
  permissions: [
    'vehicles.read',
    'drivers.read',
    'drivers.write',
    'assignments.write',
    'users.read',
  ],
};

test('the vehicle page sets its permanent driver, asking before taking it from another', async ({
  page,
}) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: manager },
    tables: {
      vehicles: [{ id: 'veh1', org_id: 'o1', traccar_device_id: 1, name: 'Delivery Van' }],
      drivers: [
        { id: 'd1', org_id: 'o1', full_name: 'דנה לוי', traccar_driver_id: 1, profile_id: null },
        { id: 'd2', org_id: 'o1', full_name: 'יוסי כהן', traccar_driver_id: 2, profile_id: 'p9' },
      ],
      profiles: [{ id: 'p9', org_id: 'o1', full_name: 'יוסי כהן', traccar_user_id: 2 }],
      current_assignments: [
        {
          id: 'a1',
          vehicle_id: 'veh1',
          driver_id: 'd1',
          traccar_device_id: 1,
          starts_at: '2026-10-01T06:00:00Z',
        },
      ],
      vehicle_driver_assignments: [],
    },
  });
  const permissions = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/permissions')) {
      permissions.push(request.postDataJSON());
    }
  });
  await gotoReady(page, '/settings/device/1');
  const field = page.getByLabel('נהג', { exact: true });
  await expect(field).toContainText('דנה לוי');
  await field.click();
  await page.getByRole('option', { name: 'Yossi Cohen' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('משויך כרגע לדנה לוי');
  await dialog.getByRole('button', { name: 'העברה' }).click();
  await expect.poll(() => fleet.tables.vehicle_driver_assignments.length).toBe(1);
  expect(fleet.tables.vehicle_driver_assignments[0]).toMatchObject({
    vehicle_id: 'veh1',
    driver_id: 'd2',
    is_primary: true,
  });
  // Yossi's own user now sees the van on the map.
  await expect.poll(() => permissions).toContainEqual({ userId: 2, deviceId: 1 });
});

test('a driver without a tag gets an identifier of their own', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/driver');
  await page.getByLabel('שם', { exact: true }).fill('רועי לוי');
  const created = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/drivers'),
  );
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  expect((await created).postDataJSON().uniqueId).toMatch(/^drv-[a-z0-9]{8}$/);
});

// ADM-14: on the driver's page the vehicle waits for "save" like every other field.
test('the driver page saves the vehicle with the driver, not on the spot', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: manager },
    tables: {
      vehicles: [{ id: 'veh1', org_id: 'o1', traccar_device_id: 1, name: 'Delivery Van' }],
      drivers: [
        { id: 'd1', org_id: 'o1', full_name: 'דנה לוי', traccar_driver_id: 1, profile_id: null },
        { id: 'd2', org_id: 'o1', full_name: 'יוסי כהן', traccar_driver_id: 2, profile_id: 'p9' },
      ],
      profiles: [{ id: 'p9', org_id: 'o1', full_name: 'יוסי כהן', traccar_user_id: 2 }],
      current_assignments: [
        {
          id: 'a1',
          vehicle_id: 'veh1',
          driver_id: 'd1',
          traccar_device_id: 1,
          starts_at: '2026-10-01T06:00:00Z',
        },
      ],
      vehicle_driver_assignments: [],
    },
  });
  const permissions = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/permissions')) {
      permissions.push(request.postDataJSON());
    }
  });
  await gotoReady(page, '/settings/driver/2');
  await page.getByLabel('רכב משויך').click();
  await page.getByRole('option', { name: 'Delivery Van' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'העברה' }).click();
  await expect(page.getByText('יישמר כששומרים את הנהג')).toBeVisible();
  expect(fleet.tables.vehicle_driver_assignments).toHaveLength(0);

  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect.poll(() => fleet.tables.vehicle_driver_assignments.length).toBe(1);
  expect(fleet.tables.vehicle_driver_assignments[0]).toMatchObject({
    vehicle_id: 'veh1',
    driver_id: 'd2',
  });
  await expect.poll(() => permissions).toContainEqual({ userId: 2, deviceId: 1 });
});
