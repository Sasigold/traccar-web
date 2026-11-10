import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// SAF-04: an incident's file for the insurer, with the minute before and after from the tracker.
test('the incident opens a printable file for the insurer', async ({ page }) => {
  await writeMode(page);
  const at = new Date(Date.now() - 3600000);
  at.setSeconds(0, 0);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['incidents.read', 'incidents.write', 'vehicles.read'],
      },
    },
    rpc: { fleet_features: ['incidents'] },
    tables: {
      vehicles: [{ id: 'v1', org_id: 'o1', plate_number: '12-345-67', traccar_device_id: 1 }],
      incidents: [
        {
          id: 'i1',
          org_id: 'o1',
          number: 7,
          vehicle_id: 'v1',
          occurred_at: at.toISOString(),
          type: 'collision',
          severity: 'minor',
          status: 'open',
          description: 'פגיעה אחורית ברמזור',
        },
      ],
      incident_parties: [],
      insurance_claims: [],
      incident_photos: [],
      drivers: [],
    },
  });
  const t = (s) => new Date(at.getTime() + s * 1000).toISOString();
  await page.route('**/api/positions?*', (route) =>
    route.fulfill({
      json: [
        { fixTime: t(-20), speed: 27, course: 90, latitude: 32.08, longitude: 34.78 },
        { fixTime: t(0), speed: 5.4, course: 92, latitude: 32.081, longitude: 34.781 },
        { fixTime: t(10), speed: 0, course: 92, latitude: 32.081, longitude: 34.781 },
      ],
    }),
  );
  await gotoReady(page, '/fleet/incident/i1');
  await page.getByRole('button', { name: 'תיק לחברת הביטוח' }).click();
  const file = page.getByRole('dialog');
  await expect(file.getByRole('heading', { name: 'תיק אירוע לחברת הביטוח' })).toBeVisible();
  await expect(file).toContainText('פגיעה אחורית ברמזור');
  await expect(file).toContainText('50 קמ"ש');
  await expect(file.getByRole('row')).toHaveCount(4);

  // On paper only the file shows.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(file.getByRole('heading', { name: 'תיק אירוע לחברת הביטוח' })).toBeVisible();
});
