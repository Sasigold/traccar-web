import { test, expect, gotoReady } from './fixtures';

// AI-06: a battery that sags at every start shows a warning on the vehicle's dials.
test('a weak battery is called out on the telemetry page', async ({ page }) => {
  await page.route('**/api/reports/route?*', (route) => {
    const start = Date.now() - 2 * 86400000;
    const rows = [0, 1, 2, 3].flatMap((index) => {
      const base = start + index * 6 * 3600000;
      return [
        {
          fixTime: new Date(base - 60000).toISOString(),
          attributes: { ignition: false, power: 12.4 },
        },
        { fixTime: new Date(base).toISOString(), attributes: { ignition: true, power: 9.2 } },
        {
          fixTime: new Date(base + 20000).toISOString(),
          attributes: { ignition: true, power: 14 },
        },
      ];
    });
    return route.fulfill({ json: rows });
  });
  await gotoReady(page, '/telemetry/1');
  await expect(page.getByRole('status').filter({ hasText: 'המצבר חלש' })).toContainText('9.2V');
});
