import { test, expect, gotoReady } from './fixtures';

test('the daily timeline shows each vehicle and a trip opens its replay', async ({ page }) => {
  await gotoReady(page, '/reports/timeline');
  const van = page.getByRole('group', { name: 'Delivery Van' });
  await expect(van.getByRole('link', { name: 'Delivery Van' })).toHaveAttribute(
    'href',
    '/fleet/vehicle/1',
  );
  const trip = van.getByRole('button', { name: /^נסיעה · / }).first();
  await expect(trip).toBeVisible();
  await trip.click();
  await expect(page).toHaveURL(/\/replay\?deviceId=1&from=.*&to=/);
});
