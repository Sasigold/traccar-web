import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000 - 1);
  return {
    from,
    query: `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
  };
};

// REP-23: how each driver kept the jobs' time windows.
test('the jobs report shows each driver on time and late', async ({ page }) => {
  const { from, query } = day();
  const at = (hours) => new Date(from.getTime() + hours * 3600000).toISOString();
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['dispatch.read', 'vehicles.read', 'drivers.read'],
      },
    },
    rpc: { fleet_features: ['dispatch'] },
    tables: {
      vehicles: [{ id: 'v1', plate_number: '11-111-11', traccar_device_id: 1 }],
      drivers: [{ id: 'd1', full_name: 'דנה כהן', traccar_driver_id: 7 }],
      dispatch_jobs: [
        ['j1', 9, 8.5],
        ['j2', 10, 11],
        ['j3', 12, 11.5],
      ].map(([id, end, arrived]) => ({
        id,
        status: 'done',
        vehicle_id: 'v1',
        driver_id: 'd1',
        scheduled_at: at(end - 1),
        window_end: at(end),
        arrived_at: at(arrived),
      })),
    },
  });
  await gotoReady(page, `/reports/jobs?deviceId=1&${query}`);
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  const row = page.getByRole('main').getByRole('row', { name: /דנה כהן/ });
  await expect(row).toContainText('67%');
});

// REP-23: a period's kilometers against the lease's quota.
test('the lease report weighs the period against the quota', async ({ page }) => {
  const { query } = day();
  const now = new Date();
  const iso = (date) => date.toISOString().slice(0, 10);
  await writeMode(page);
  const device = await (await page.request.get('/api/devices/1')).json();
  await page.request.put('/api/devices/1', {
    data: {
      ...device,
      attributes: {
        ...device.attributes,
        ownership: 'leased',
        leaseStartDate: iso(new Date(now.getFullYear() - 1, now.getMonth(), 1)),
        leaseEndDate: iso(new Date(now.getFullYear() + 1, now.getMonth(), 1)),
        leaseKmQuota: 73000,
      },
    },
  });
  await page.route('**/api/reports/summary?*', (route) =>
    route.fulfill({ json: [{ deviceId: 1, distance: 200000 }] }),
  );
  await gotoReady(page, `/reports/lease?deviceId=1&deviceId=2&${query}`);
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  const main = page.getByRole('main');
  const row = main.getByRole('row', { name: /Delivery Van/ });
  // 73,000 km over two years is 100 km a day: 200 km is double.
  await expect(row).toContainText('200%');
  // Only leased vehicles.
  await expect(main.getByRole('row', { name: /Service Van/ })).toHaveCount(0);
});

// REP-16, REP-23: the month on one page, against the month before.
test('the management summary weighs the month against the one before', async ({ page }) => {
  await page.route('**/api/reports/summary?*', (route) => {
    const from = new Date(new URL(route.request().url()).searchParams.get('from'));
    // The chosen month (October) drove 150 km; September drove 100.
    const distance = from.getMonth() === 9 ? 150000 : 100000;
    return route.fulfill({ json: [{ deviceId: 1, distance, engineHours: 3600000 }] });
  });
  await page.route('**/api/reports/events?*', (route) =>
    route.fulfill({ json: [{ id: 1, deviceId: 1, type: 'deviceOverspeed' }] }),
  );
  await page.addInitScript(() =>
    localStorage.setItem('managementMonth', JSON.stringify('2026-10')),
  );
  await gotoReady(page, '/reports/management');
  const main = page.getByRole('main');
  await expect(main.getByText('▲ 50% מהתקופה הקודמת')).toBeVisible();
  await expect(main.getByRole('heading', { name: 'הכי הרבה ק"מ' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'הדפסה / PDF' })).toBeEnabled();
});
