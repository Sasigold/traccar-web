import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ISR-11: the vehicle's handovers are listed on its page, and each opens as a signed document.
test('a handover opens from the vehicle page as a document to print', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['vehicles.read', 'inspections.read'],
      },
    },
    tables: {
      vehicles: [{ id: 'v1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' }],
      drivers: [{ id: 'd1', org_id: 'o1', full_name: 'דנה לוי' }],
      vehicle_handovers: [
        {
          id: 'h1',
          org_id: 'o1',
          vehicle_id: 'v1',
          driver_id: 'd1',
          kind: 'handover',
          odometer_km: 45210,
          fuel_percent: 75,
          damages: 'שריטה בדלת',
          photo_paths: [],
          giver_name: 'יוסי',
          created_at: '2026-11-08T07:30:00Z',
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/vehicle/1?tab=inspections');
  await page.getByRole('link', { name: /08\.11\.2026/ }).click();
  await expect(page).toHaveURL(/\/fleet\/handover\/h1$/);
  await expect(page.getByText('שריטה בדלת')).toBeVisible();
  await expect(page.getByText('דנה לוי', { exact: true })).toBeVisible();
  await expect(page.getByText('75%')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.vf-print-header')).toContainText('SYNC POINT / HANDOVER');
});
