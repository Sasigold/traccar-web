import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// BIZ-02: an area outside the organization's plan says which plan has it.
const owner = {
  profile: { id: 'p1', org_id: 'o1', role: 'owner' },
  permissions: ['costs.read', 'integrations.manage', 'vehicles.read'],
};

test('a tracking plan sees where costs and the API live', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: owner },
    rpc: { fleet_features: ['costs', 'integrations'], org_plan: { plan: 'tracking' } },
    tables: { vehicle_expenses: [], api_keys: [], webhooks: [], webhook_deliveries: [] },
  });
  await gotoReady(page, '/fleet/costs');
  await expect(page.getByText('האזור הזה זמין בחבילת ניהול צי')).toBeVisible();
  await gotoReady(page, '/fleet/integrations');
  await expect(page.getByText('האזור הזה זמין בחבילת מקצועית')).toBeVisible();
});

test('a trial opens the next plan', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: owner },
    rpc: {
      fleet_features: ['costs'],
      org_plan: { plan: 'tracking', trial: 'fleet', trial_until: '2099-01-01T00:00:00Z' },
    },
    tables: { vehicle_expenses: [] },
  });
  await gotoReady(page, '/fleet/costs');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/זמין בחבילת/)).toHaveCount(0);
});
