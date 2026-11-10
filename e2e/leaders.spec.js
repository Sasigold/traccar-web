import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// SAF-05: this week's leaders, ranked within the group of the vehicle each drove most.
test("this week's leaders are ranked in groups", async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['safety.read'] },
    },
    rpc: { fleet_features: ['safety'] },
    tables: { safety_settings: [], safety_event_reviews: [], vehicle_driver_assignments: [] },
  });
  await gotoReady(page, '/fleet/safety?view=leaders');
  await expect(page.getByRole('button', { name: 'מובילי השבוע' })).toBeVisible();
  // A group heading row, then its drivers from rank 1.
  await expect(page.getByRole('cell', { name: '1', exact: true }).first()).toBeVisible();
  await expect(page.getByText(/בלי אירוע|—/).first()).toBeVisible();
});
