import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-20: on the way is normal, late is a warning; a job is duplicated or cancelled from its
// row; a failed job says why.
const dispatcher = {
  profile: { id: 'p1', org_id: 'o1', role: 'dispatcher' },
  permissions: ['dispatch.read', 'dispatch.write', 'vehicles.read', 'drivers.read', 'poi.read'],
};
const hour = 3600000;
const job = (id, title, status, windowEnd, extra = {}) => ({
  id,
  org_id: 'o1',
  number: id.length,
  title,
  type: 'delivery',
  priority: 'normal',
  status,
  scheduled_at: new Date(Date.now() - 2 * hour).toISOString(),
  window_end: new Date(Date.now() + windowEnd * hour).toISOString(),
  ...extra,
});

test('late jobs stand out, and a row is duplicated or cancelled', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the row menu is the same on a phone card');
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: dispatcher },
    rpc: { fleet_features: ['dispatch'] },
    tables: {
      dispatch_jobs: [
        job('j1', 'משלוח לחיפה', 'en_route', -1),
        job('j22', 'משלוח לנתניה', 'en_route', 2, { customer_name: 'שלמה' }),
      ],
      pois: [],
      vehicles: [],
      drivers: [],
    },
  });
  await gotoReady(page, '/fleet/dispatch');
  const late = page.getByRole('row', { name: /משלוח לחיפה/ });
  const onTime = page.getByRole('row', { name: /משלוח לנתניה/ });
  await expect(late).toContainText('באיחור');
  await expect(onTime).not.toContainText('באיחור');

  await onTime.getByRole('button', { name: 'פעולות' }).click();
  await page.getByRole('menuitem', { name: 'שכפול' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: 'משימה' })).toHaveValue('משלוח לנתניה');
  await dialog.getByRole('button', { name: 'ביטול' }).click();

  await late.getByRole('button', { name: 'פעולות' }).click();
  await page.getByRole('menuitem', { name: 'ביטול המשימה' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול המשימה' }).click();
  await expect
    .poll(() => fleet.tables.dispatch_jobs.find((row) => row.id === 'j1').status)
    .toBe('cancelled');
});
