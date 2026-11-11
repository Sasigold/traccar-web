import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ARC-09: where the dashboards are kept. With the fleet database's `dashboards` area they are
// rows there (and the Traccar copy is moved over, then removed); without it, a save changes
// only its own attribute of the latest Traccar user or server settings.

const traccarDoc = JSON.stringify({
  v: 1,
  a: 'x',
  t: 100,
  d: [
    {
      i: 'x',
      n: 'מטרקאר',
      f: ['today'],
      g: [],
      r: 0,
      L: [[3, [12, 'w1']]],
      W: { w1: 'fleetKpis' },
    },
  ],
});

const orgDefaultDoc = {
  v: 1,
  a: 'o',
  t: 100,
  d: [
    {
      i: 'o',
      n: 'של הארגון',
      f: ['today'],
      g: [],
      r: 0,
      L: [[3, [12, 'w1']]],
      W: { w1: 'fleetKpis' },
    },
  ],
};

const owner = {
  profile: { id: 'p1', org_id: 'o1', role: 'owner' },
  permissions: ['users.manage', 'reports.read'],
};

// The Traccar user (and the copy a save reads first) with extra attributes.
const withUserAttributes = async (page, attributes) => {
  const patch = async (route) => {
    const response = await route.fetch();
    const user = await response.json();
    await route.fulfill({
      response,
      json: { ...user, attributes: { ...user.attributes, ...attributes } },
    });
  };
  await page.route('**/api/session', (route) =>
    route.request().method() === 'GET' ? patch(route) : route.fallback(),
  );
  await page.route('**/api/users/1', (route) =>
    route.request().method() === 'GET' ? patch(route) : route.fallback(),
  );
};

const publish = async (page) => {
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await page.getByRole('menuitem', { name: 'פרסום כברירת מחדל לארגון' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'אישור' }).click();
  await expect(page.getByText('פורסם כברירת המחדל של הארגון')).toBeVisible();
};

test('without the fleet area, a save changes one attribute of the latest copy', async ({
  page,
}) => {
  await writeMode(page);
  await fakeFleet(page, { users: { 1: owner }, rpc: { fleet_features: ['automations'] } });
  await gotoReady(page, '/dashboard');
  await page.locator('[data-widget-id]').first().waitFor();

  // Someone changed the user and the server settings after this page loaded.
  await page.route('**/api/users/1', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const user = await response.json();
    return route.fulfill({
      response,
      json: { ...user, attributes: { ...user.attributes, changedElsewhere: 'yes' } },
    });
  });
  await page.route('**/api/server', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const server = await response.json();
    return route.fulfill({
      response,
      json: { ...server, attributes: { ...server.attributes, setElsewhere: 'yes' } },
    });
  });

  const userPut = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().endsWith('/api/users/1'),
  );
  const period = page.getByRole('combobox', { name: 'תקופה' });
  await period.click();
  await page.getByRole('option', { name: 'חודש נוכחי' }).click();
  const { attributes } = (await userPut).postDataJSON();
  expect(attributes.changedElsewhere).toBe('yes');
  expect(JSON.parse(attributes['web.dashboard']).d[0].f[0]).toBe('thisMonth');

  const serverPut = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().endsWith('/api/server'),
  );
  await publish(page);
  const server = (await serverPut).postDataJSON();
  expect(server.attributes.setElsewhere).toBe('yes');
  expect(JSON.parse(server.attributes['web.dashboardDefault']).d).toHaveLength(1);
});

test('with the fleet area, the Traccar copy moves to the database and the default is a row', async ({
  page,
}) => {
  await writeMode(page);
  await withUserAttributes(page, { 'web.dashboard': traccarDoc, kept: 'yes' });
  const fleet = await fakeFleet(page, {
    users: { 1: owner },
    rpc: { fleet_features: ['dashboards'] },
    tables: { dashboards: [], dashboard_defaults: [] },
  });
  const serverPuts = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith('/api/server'))
      serverPuts.push(request);
  });
  const userPut = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().endsWith('/api/users/1'),
  );
  await gotoReady(page, '/dashboard');
  await expect(page.getByRole('tab', { name: 'מטרקאר' })).toBeVisible();

  await expect.poll(() => fleet.tables.dashboards.length).toBe(1);
  expect(fleet.tables.dashboards[0]).toMatchObject({ profile_id: 'p1', org_id: 'o1' });
  expect(fleet.tables.dashboards[0].doc.d[0].n).toBe('מטרקאר');
  // Once it is in the database, the attribute is removed (and nothing else is touched).
  const { attributes } = (await userPut).postDataJSON();
  expect(attributes['web.dashboard']).toBeUndefined();
  expect(attributes.kept).toBe('yes');

  await publish(page);
  expect(fleet.tables.dashboard_defaults).toHaveLength(1);
  expect(fleet.tables.dashboard_defaults[0]).toMatchObject({ org_id: 'o1' });
  expect(fleet.tables.dashboard_defaults[0].doc.d[0].n).toBe('מטרקאר');
  expect(serverPuts).toHaveLength(0);
});

test('a new member starts from the organization default, and only users.manage publishes', async ({
  page,
}) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p2', org_id: 'o1', role: 'viewer' }, permissions: ['reports.read'] },
    },
    rpc: { fleet_features: ['dashboards'] },
    tables: {
      dashboards: [],
      dashboard_defaults: [{ id: 'd1', org_id: 'o1', doc: orgDefaultDoc }],
    },
  });
  await gotoReady(page, '/dashboard');
  await expect(page.getByRole('tab', { name: 'של הארגון' })).toBeVisible();
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await expect(page.getByRole('menuitem', { name: 'שחזור לברירת המחדל של הארגון' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'פרסום כברירת מחדל לארגון' })).toHaveCount(0);
});
