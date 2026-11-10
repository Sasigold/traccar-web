import { test, expect, gotoReady } from './fixtures';

// BRD-05: the Israeli demo fleet (cookie demoFleet=il, or `npm run demo:il`).
test('the Israeli demo fleet has Hebrew vehicles in Israeli cities', async ({ page, isMobile }) => {
  await page
    .context()
    .addCookies([{ name: 'demoFleet', value: 'il', url: 'http://localhost:3000' }]);
  await gotoReady(page, '/');
  if (isMobile) await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  await expect(page.getByText('טרנזיט חלוקה צפון').first()).toBeVisible();
  await expect(page.getByText('Delivery Van')).toHaveCount(0);
  const positions = await page.evaluate(async () => (await fetch('/api/positions')).json());
  expect(positions.every((p) => p.latitude > 29.4 && p.latitude < 33.4)).toBe(true);
  expect(positions.some((p) => p.address.includes('חיפה'))).toBe(true);
});
