import { test, expect, gotoReady } from './fixtures';

// LIV-27: the heat map as a layer of the live map, for the vehicles in the list.
test('the live map shows a heat layer over a chosen period', async ({ page }) => {
  await gotoReady(page, '/');
  const stops = page.waitForRequest((request) => request.url().includes('/api/reports/stops'));
  await page.getByRole('button', { name: 'מפת חום' }).click();
  const url = new URL((await stops).url());
  expect(url.searchParams.getAll('deviceId').length).toBeGreaterThan(1);

  const panel = page.getByRole('region', { name: 'מפת חום' });
  await expect(panel.getByRole('status')).toHaveText(/\d+ נקודות/);

  // Another period asks again, for 30 days.
  const month = page.waitForRequest((request) => request.url().includes('/api/reports/stops'));
  await panel.getByRole('button', { name: '30 ימים' }).click();
  const query = new URL((await month).url()).searchParams;
  const days = (Date.parse(query.get('to')) - Date.parse(query.get('from'))) / 86400000;
  expect(Math.round(days)).toBe(30);
  await expect(panel.getByRole('button', { name: '30 ימים' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Speeding comes from the combined report.
  const combined = page.waitForRequest((request) =>
    request.url().includes('/api/reports/combined'),
  );
  await panel.getByRole('combobox', { name: 'מה להציג' }).click();
  await page.getByRole('option', { name: /מהירות/ }).click();
  await combined;

  await panel.getByRole('button', { name: 'סגירת מפת החום' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'מפת חום' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
