import { test, expect, gotoReady } from './fixtures';

// REP-07: from a report row to the same vehicle and time elsewhere.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('a stop opens the route replay around it', async ({ page }) => {
  await gotoReady(page, `/reports/stops?deviceId=3&${day()}`);
  const replay = page.getByRole('link', { name: 'שחזור המסלול סביב העצירה' }).first();
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page).toHaveURL(/\/replay\?deviceId=3&from=.*&to=/);
});

test('a summary row opens the trips of that vehicle', async ({ page }) => {
  await gotoReady(page, `/reports/summary?deviceId=1&${day()}`);
  await page
    .getByRole('link', { name: /הנסיעות: Delivery Van/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/reports\/trips\?deviceId=1&from=.*&to=/);
});
