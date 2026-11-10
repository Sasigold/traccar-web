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
