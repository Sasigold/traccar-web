import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// AI-05: a rule from a template, tested on the last week before it is turned on, then acting
// on a live alert.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'manager' },
  permissions: ['alerts.read', 'alerts.manage'],
};

test('a rule is tested on the week, saved, and fires on a live alert', async ({
  page,
  context,
}) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['automations', 'alerts'] },
    tables: { automation_rules: [], automation_runs: [] },
  });
  await page.route('**/api/reports/events?*', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          deviceId: 1,
          type: 'deviceOverspeed',
          eventTime: new Date().toISOString(),
          attributes: { speed: 70 },
        },
        {
          id: 2,
          deviceId: 2,
          type: 'deviceOverspeed',
          eventTime: new Date().toISOString(),
          attributes: { speed: 50 },
        },
      ],
    }),
  );
  const client = `t${Math.random().toString(36).slice(2)}`;
  await context.addCookies([{ name: 'demoClient', value: client, url: 'http://localhost:3000' }]);
  await gotoReady(page, '/fleet/automations');
  await page.getByRole('button', { name: 'כלל חדש' }).click();
  const dialog = page.getByRole('dialog', { name: 'כלל חדש' });
  await dialog.getByLabel('תבנית').click();
  await page.getByRole('option', { name: 'מהירות מעל סף' }).click();
  await dialog.getByLabel('מהירות (קמ"ש)').fill('115');
  await dialog.getByLabel('מהירות (קמ"ש)').fill('110');
  await expect(dialog.getByText('כשרכב נוסע מעל 110 קמ"ש, תצא התראה.')).toBeVisible();
  await dialog.getByRole('button', { name: 'בדיקה על 7 הימים האחרונים' }).click();
  await expect(dialog.getByRole('status')).toContainText('בשבוע האחרון הכלל היה פועל 1 פעמים');
  await dialog.getByRole('button', { name: 'שמירה והפעלה' }).click();
  await expect.poll(() => fleet.tables.automation_rules.length).toBe(1);
  expect(fleet.tables.automation_rules[0]).toMatchObject({
    template: 'overspeed',
    params: { speed: 110 },
    active: true,
    tested_matches: 1,
  });

  // A live overspeed of 130 km/h (70 knots) fires it once.
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/demo/event?client=${client}&deviceId=2&type=deviceOverspeed&speed=70`,
      );
      return (await response.json()).sent;
    })
    .toBeGreaterThan(0);
  await expect(page.getByText(/^אוטומציה: כשרכב נוסע מעל 110/)).toBeVisible();
  await expect.poll(() => fleet.tables.automation_runs.length).toBe(1);
});
