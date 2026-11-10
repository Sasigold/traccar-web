import { test, expect, gotoReady } from './fixtures';

// LIV-18: the event page says what happened to which vehicle, and what to expect when there is no
// location; the telemetry page says "live" only while positions keep arriving.
const event = (positionId) => ({
  id: 9001,
  type: 'deviceOverspeed',
  eventTime: new Date().toISOString(),
  deviceId: 1,
  positionId,
  attributes: { speed: 60 },
});

test.describe('event and telemetry pages', () => {
  test('an event shows the vehicle in its title and its card on the map', async ({ page }) => {
    await page.route('**/api/events/9001', (route) => route.fulfill({ json: event(7001) }));
    await page.route('**/api/positions?id=7001', (route) =>
      route.fulfill({
        json: [
          {
            id: 7001,
            deviceId: 1,
            latitude: 32.08,
            longitude: 34.78,
            speed: 50,
            course: 0,
            fixTime: new Date().toISOString(),
            attributes: {},
          },
        ],
      }),
    );
    await gotoReady(page, '/event/9001');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/ · Delivery Van/);
    await expect(page.getByRole('region').getByText('Delivery Van').first()).toBeVisible();
    await expect(page.getByText('לאירוע הזה אין מיקום')).toHaveCount(0);
  });

  test('an event without a location says so', async ({ page }) => {
    await page.route('**/api/events/9001', (route) => route.fulfill({ json: event(0) }));
    await gotoReady(page, '/event/9001');
    await expect(page.getByRole('status').getByText('לאירוע הזה אין מיקום')).toBeVisible();
  });

  test('"live" follows the age of the last position', async ({ page }) => {
    await gotoReady(page, '/telemetry/1');
    await expect(page.getByRole('status').filter({ hasText: 'בזמן אמת' })).toBeVisible();
    // An hour without a position: still online, no longer live (the 60-second rule is unit-tested).
    await page.clock.install();
    await page.clock.fastForward('01:00:00');
    await expect(page.getByRole('status').filter({ hasText: 'בזמן אמת' })).toHaveCount(0);
  });
});
