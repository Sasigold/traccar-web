import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ARC-08: a list longer than one page is read to the end, not cut at 500 or 1,000.
test('every incident shows, past the first page', async ({ page }) => {
  await writeMode(page);
  const incidents = Array.from({ length: 1205 }, (_, i) => ({
    id: `i${i}`,
    org_id: 'o1',
    number: i + 1,
    occurred_at: new Date(Date.now() - i * 3600000).toISOString(),
    type: 'collision',
    severity: 'minor',
    status: 'open',
  }));
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['incidents.read'] },
    },
    rpc: { fleet_features: ['incidents'] },
    tables: { incidents, vehicles: [], drivers: [] },
  });
  await gotoReady(page, '/fleet/incidents');
  await expect(page.getByText('1205', { exact: true }).first()).toBeVisible();
});
