import { test, expect, gotoReady, FLEET } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-21: one way to say what state the fleet services are in.
test('no access is a locked state with whom to ask, and no empty table', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: { profile: { id: 'p1', org_id: 'o1', role: 'viewer' }, permissions: [] } },
    rpc: { org_contact: { name: 'דנה כהן', phone: '0501234567' } },
    tables: { work_orders: [] },
  });
  await gotoReady(page, '/fleet/work-orders');
  await expect(page.getByText('אין לכם גישה לתחזוקה והזמנות עבודה')).toBeVisible();
  await expect(page.getByText('אפשר לבקש הרשאה מדנה כהן.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'רענון הרשאות' })).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();
  await expect(page.getByText(/\.read|\.manage/)).toHaveCount(0);
});

test('a failed connection says so plainly and is tried again by itself', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'admin' }, permissions: ['incidents.read'] },
    },
    tables: { incidents: [] },
  });
  let failures = 1;
  await page.route(`${FLEET}/functions/v1/traccar-auth`, (route) => {
    if (failures > 0) {
      failures -= 1;
      return route.fulfill({ status: 503, body: 'down' });
    }
    return route.fallback();
  });
  await gotoReady(page, '/fleet/incidents');
  await expect(page.getByText('שירותי הצי לא זמינים כרגע', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'נסו שוב' })).toBeVisible();
  // The automatic retry after five seconds connects.
  await expect(page.getByText('שירותי הצי לא זמינים כרגע', { exact: false })).toBeHidden({
    timeout: 12000,
  });
  await expect(page.getByRole('table')).toBeVisible();
});
