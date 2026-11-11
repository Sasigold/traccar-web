import { test, expect, gotoReady } from './fixtures';

// REP-14: the trips report marks a trip on Shabbat and one after working hours.
test('trips on Shabbat and after hours are marked', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'tripColumns',
      JSON.stringify(['startTime', 'distance', 'outsideHours', 'restDay']),
    ),
  );
  const trip = (startTime, distance) => ({
    deviceId: 1,
    startTime,
    endTime: startTime,
    distance,
    duration: 600000,
    averageSpeed: 20,
    maxSpeed: 30,
  });
  await page.route('**/api/reports/trips?*', (route) =>
    route.fulfill({
      json: [
        trip('2026-11-07T10:00:00Z', 11000),
        trip('2026-11-09T20:00:00Z', 22000),
        trip('2026-11-09T07:00:00Z', 33000),
      ],
    }),
  );
  const from = encodeURIComponent('2026-11-07T00:00:00Z');
  const to = encodeURIComponent('2026-11-10T00:00:00Z');
  await gotoReady(page, `/reports/trips?deviceId=1&from=${from}&to=${to}`);
  const rowOf = (km) =>
    page
      .getByRole('row')
      .filter({ hasText: `${km} ק"מ` })
      .first();
  await expect(rowOf(11)).toContainText('שבת');
  await expect(rowOf(22)).toContainText('כן');
  await expect(rowOf(33)).not.toContainText('כן');
  await expect(rowOf(33)).not.toContainText('שבת');
});
