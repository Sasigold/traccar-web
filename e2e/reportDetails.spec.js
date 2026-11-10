import { test, expect, gotoReady } from './fixtures';

// REP-14: what single reports add: short stops filtered out, idling only, the event's own time
// and a visit that is still going on.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('stops: a minimum duration and idling only', async ({ page }) => {
  await page.route('**/api/reports/stops?*', async (route) => {
    const response = await route.fetch();
    const [row] = await response.json();
    const stop = (minutes, engineMinutes) => ({
      ...row,
      startTime: new Date(Date.now() - minutes * 60000).toISOString(),
      duration: minutes * 60000,
      engineHours: engineMinutes * 60000,
    });
    await route.fulfill({ response, json: [stop(2, 0), stop(20, 0), stop(40, 10)] });
  });
  await gotoReady(page, `/reports/stops?deviceId=3&${day()}`);
  const count = page
    .locator('table tbody tr')
    .filter({ has: page.getByRole('button', { name: 'הצגה במפה' }) });
  await expect(count).toHaveCount(3);

  await page.getByLabel('עצירות של לפחות').click();
  await page.getByRole('option', { name: '15 דקות' }).click();
  await expect(count).toHaveCount(2);
  await page.getByLabel('רק סרק (מנוע פועל)').check();
  await expect(count).toHaveCount(1);
});

test('events are timed by the event, and a geofence visit can still be going on', async ({
  page,
}) => {
  await gotoReady(page, `/reports/events?deviceId=1&${day()}`);
  // On phones the rows are cards that carry the column names.
  await expect(page.getByText('זמן האירוע', { exact: true }).first()).toBeAttached();

  await page.route('**/api/reports/geofences?*', (route) =>
    route.fulfill({
      json: [
        {
          deviceId: 1,
          geofenceId: 1,
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: null,
        },
      ],
    }),
  );
  await gotoReady(page, `/reports/geofences?deviceId=1&${day()}`);
  const row = page.getByRole('row').filter({ hasText: 'Delivery Van' });
  await expect(row).toContainText('עדיין בפנים');
  await expect(row).toContainText('עד עכשיו');
  await expect(row).not.toContainText('NaN');
});

test('an overspeed is graded against the road limit (SAF-06)', async ({ page }) => {
  await page.route('**/api/reports/events?*', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          deviceId: 1,
          type: 'deviceOverspeed',
          eventTime: new Date().toISOString(),
          positionId: 0,
          attributes: { speed: 60.48, speedLimit: 48.6 },
        },
      ],
    }),
  );
  await gotoReady(page, `/reports/events?deviceId=1&${day()}`);
  await expect(page.getByText(/מותר .* · חריגה חמורה \(מעל 20\)/).first()).toBeAttached();
});

test('the geofences report adds up each geofence (REP-14)', async ({ page }) => {
  const at = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
  await page.route('**/api/reports/geofences?*', (route) =>
    route.fulfill({
      json: [
        { deviceId: 1, geofenceId: 1, startTime: at(5), endTime: at(4) },
        { deviceId: 2, geofenceId: 1, startTime: at(3), endTime: at(2) },
        { deviceId: 1, geofenceId: 1, startTime: at(1), endTime: null },
      ],
    }),
  );
  await gotoReady(page, `/reports/geofences?deviceId=1&deviceId=2&${day()}`);
  await page.getByRole('button', { name: 'לפי אזור' }).click();
  await expect(page).toHaveURL(/view=geofence/);
  // A view, not a filter: the results stay current.
  await expect(page.getByRole('status').filter({ hasText: 'הסינון השתנה' })).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: '3' }).last();
  // Three visits, two vehicles, one still inside.
  await expect(row.getByRole('cell').nth(1)).toHaveText('3');
  await expect(row.getByRole('cell').nth(2)).toHaveText('2');
  await expect(row.getByRole('cell').nth(5)).toHaveText('1');
});
