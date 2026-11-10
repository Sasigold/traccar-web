import { test, expect, gotoReady } from './fixtures';
import { fakeFleet } from './fakeFleet';

// ADM-03: the viewer role (Traccar read only, fleet *.read) reaches the fleet area and reads it,
// without ways to change it.
test('a viewer finds the fleet in the navigation and reads the vehicles', async ({
  page,
  isMobile,
}) => {
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'viewer' },
        permissions: ['vehicles.read', 'drivers.read', 'documents.read', 'maintenance.read'],
      },
    },
  });
  // The demo user is read only in Traccar, as a viewer is; the fake token is accepted by the
  // fake traccar-auth as user 1.
  await page.route('**/functions/v1/traccar-auth', (route) =>
    route.fulfill({
      json: {
        access_token: 'jwt-1',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        profile: { id: 'p1', org_id: 'o1', role: 'viewer' },
        permissions: ['vehicles.read', 'drivers.read', 'documents.read', 'maintenance.read'],
      },
    }),
  );
  await gotoReady(page, '/');
  // The rail on desktop, the tab bar on phones.
  const fleetLink = page
    .getByRole(isMobile ? 'button' : 'link', { name: 'צי', exact: true })
    .filter({ visible: true });
  await expect(fleetLink.first()).toBeVisible();
  await fleetLink.first().click();
  await expect(page).toHaveURL(/\/fleet$/);

  await gotoReady(page, '/fleet/vehicles');
  await expect(page.getByText('Delivery Van').first()).toBeVisible();
  // Read only: no way to add or change a vehicle.
  await expect(page.getByRole('button', { name: /הוספ/ })).toHaveCount(0);
  if (!isMobile) {
    await expect(page.getByRole('link', { name: 'רכבים' }).first()).toBeVisible();
  }
});
