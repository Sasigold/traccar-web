import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// REP-05: a driver in the dashboard's filter narrows it to the vehicles they had in the period.
test('the dashboard narrows to the vehicles of one driver', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager', full_name: 'דנה' },
        permissions: ['vehicles.read', 'drivers.read'],
      },
    },
    tables: {
      drivers: [{ id: 'd1', org_id: 'o1', full_name: 'יוסי כהן' }],
      vehicles: [{ id: 'v1', org_id: 'o1', plate_number: '12-345-67', traccar_device_id: 2 }],
      vehicle_driver_assignments: [
        {
          id: 'a1',
          org_id: 'o1',
          vehicle_id: 'v1',
          driver_id: 'd1',
          starts_at: '2026-01-01T00:00:00Z',
          ends_at: null,
        },
      ],
    },
  });
  await gotoReady(page, '/dashboard');
  // The fleet-now tile counts the vehicles in scope.
  const fleetNow = page
    .getByRole('region')
    .filter({ has: page.getByRole('heading', { name: 'הצי עכשיו' }) });
  const vehicles = fleetNow
    .getByText('רכבים', { exact: true })
    .locator('xpath=following-sibling::*[1]');
  await expect(vehicles).not.toHaveText('1');

  await page.getByRole('combobox', { name: 'נהג: הרכבים שהיו אצלו בתקופה' }).click();
  await page.getByRole('option', { name: 'יוסי כהן' }).click();
  await expect(page.getByRole('combobox', { name: 'נהג: הרכבים שהיו אצלו בתקופה' })).toHaveText(
    'יוסי כהן',
  );
  await expect(vehicles).toHaveText('1');
});
