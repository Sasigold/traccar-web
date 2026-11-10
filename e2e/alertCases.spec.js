import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// LIV-24: an alert is handled: new with a countdown, taken, assigned, noted and closed; the
// response times are reported per person.
const dispatcher = {
  profile: { id: 'p1', org_id: 'o1', role: 'dispatcher', full_name: 'דנה' },
  permissions: ['alerts.read'],
};
const people = [
  { id: 'p1', org_id: 'o1', full_name: 'דנה', is_active: true },
  { id: 'p2', org_id: 'o1', full_name: 'יוסי', is_active: true },
];

test('an alert is taken, assigned, noted and closed', async ({ page, context }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: dispatcher },
    rpc: { fleet_features: ['alertCases'] },
    tables: { profiles: people, alert_cases: [], alert_case_notes: [] },
  });
  const client = `t${Math.random().toString(36).slice(2)}`;
  await context.addCookies([{ name: 'demoClient', value: client, url: 'http://localhost:3000' }]);
  await gotoReady(page, '/');
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/demo/event?client=${client}&deviceId=2&type=deviceOverspeed&speed=60`,
      );
      return (await response.json()).sent;
    })
    .toBeGreaterThan(0);

  await page
    .getByRole('button', { name: /^התראות/ })
    .first()
    .click();
  const list = page.getByRole('dialog', { name: 'התראות' });
  const chip = list.getByRole('button', { name: /^טיפול בהתראה · Service Van/ });
  await expect(chip).toHaveAccessibleName(/נותרו 1[45] דק'/);
  await chip.click();

  const dialog = page.getByRole('dialog', { name: /Service Van/ });
  await dialog.getByRole('button', { name: 'בטיפול' }).click();
  await expect.poll(() => fleet.tables.alert_cases.length).toBe(1);
  expect(fleet.tables.alert_cases[0]).toMatchObject({
    org_id: 'o1',
    traccar_device_id: 2,
    event_type: 'deviceOverspeed',
    status: 'in_progress',
  });
  await expect(dialog.getByRole('button', { name: 'בטיפול' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await dialog.getByLabel('מטפל').click();
  await page.getByRole('option', { name: 'יוסי' }).click();
  await expect.poll(() => fleet.tables.alert_cases[0].assigned_to).toBe('p2');

  await dialog.getByLabel('הערה חדשה').fill('הנהג אישר שהאט');
  await dialog.getByRole('button', { name: 'הוספה' }).click();
  await expect(dialog.getByText('הנהג אישר שהאט')).toBeVisible();
  expect(fleet.tables.alert_case_notes[0]).toMatchObject({
    case_id: fleet.tables.alert_cases[0].id,
    body: 'הנהג אישר שהאט',
  });

  await dialog.getByRole('button', { name: 'נסגר' }).click();
  await expect.poll(() => fleet.tables.alert_cases[0].status).toBe('closed');
  await dialog.getByRole('button', { name: 'סגירה' }).click();
  await expect(chip).toHaveAccessibleName(/נסגר$/);
});

test('response times per person, and the target', async ({ page }) => {
  await writeMode(page);
  const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();
  await fakeFleet(page, {
    users: { 1: { ...dispatcher, permissions: ['alerts.read', 'alerts.manage'] } },
    rpc: { fleet_features: ['alertCases'] },
    tables: {
      profiles: people,
      org_alert_settings: [{ org_id: 'o1', sla_minutes: 10 }],
      alert_cases: [
        {
          id: 'c1',
          org_id: 'o1',
          traccar_event_id: 1,
          occurred_at: at(60),
          taken_at: at(55),
          taken_by: 'p1',
          status: 'closed',
        },
        {
          id: 'c2',
          org_id: 'o1',
          traccar_event_id: 2,
          occurred_at: at(60),
          taken_at: at(30),
          taken_by: 'p2',
          status: 'closed',
        },
        {
          id: 'c3',
          org_id: 'o1',
          traccar_event_id: 3,
          occurred_at: at(5),
          taken_at: null,
          taken_by: null,
          status: 'new',
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/alerts/response');
  const tile = (name) => page.getByRole('status').filter({ hasText: name });
  await expect(tile('יעד תגובה (דקות)')).toContainText('10');
  await expect(tile('פתוחות')).toContainText('1');
  await expect(tile('בתוך היעד')).toContainText('50%');
  await expect(page.getByRole('row', { name: /דנה/ })).toContainText('100%');
  await expect(page.getByRole('row', { name: /יוסי/ })).toContainText('0%');
});

// LIV-24: from an overspeed alert to the safety inbox, or to a rule of the same kind.
test('an overspeed alert leads to the safety inbox and to a ready rule', async ({
  page,
  context,
}) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager', full_name: 'דנה' },
        permissions: ['alerts.read', 'alerts.manage', 'safety.read'],
      },
    },
    rpc: { fleet_features: ['alertCases', 'automations', 'safety'] },
    tables: {
      profiles: people,
      alert_cases: [],
      alert_case_notes: [],
      automation_rules: [],
      automation_runs: [],
    },
  });
  const client = `t${Math.random().toString(36).slice(2)}`;
  await context.addCookies([{ name: 'demoClient', value: client, url: 'http://localhost:3000' }]);
  await gotoReady(page, '/');
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/demo/event?client=${client}&deviceId=2&type=deviceOverspeed&speed=60`,
      );
      return (await response.json()).sent;
    })
    .toBeGreaterThan(0);
  await page
    .getByRole('button', { name: /^התראות/ })
    .first()
    .click();
  await page
    .getByRole('dialog', { name: 'התראות' })
    .getByRole('button', { name: /^טיפול בהתראה · Service Van/ })
    .click();
  const dialog = page.getByRole('dialog', { name: /Service Van/ });
  await expect(dialog.getByRole('link', { name: 'לתיבת הבטיחות' })).toHaveAttribute(
    'href',
    '/fleet/safety/inbox',
  );
  await dialog.getByRole('link', { name: 'כלל אוטומטי מזה' }).click();
  await expect(page).toHaveURL(/\/fleet\/automations\?template=overspeed/);
  await expect(page.getByRole('dialog', { name: 'כלל חדש' }).getByLabel(/מהירות/)).toHaveValue(
    '111',
  );
});
