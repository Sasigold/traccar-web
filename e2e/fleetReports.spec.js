import { test, expect, axe, formatViolations, gotoReady } from './fixtures';

const ids = [1, 2, 3, 4, 5, 6].map((id) => `deviceId=${id}`).join('&');

for (const [name, path] of [
  ['usage', 'usage'],
  ['cost per km', 'cost-per-km'],
  ['device health', 'device-health'],
]) {
  test(`the ${name} report lists every chosen vehicle`, async ({ page }) => {
    await gotoReady(page, `/reports/${path}?${ids}&period=today`);
    await page.getByRole('button', { name: 'הצג', exact: true }).click();
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Delivery Van' })).toHaveAttribute(
      'href',
      '/fleet/vehicle/1',
    );
    await expect(main.getByRole('link', { name: 'Service Van' })).toBeVisible();
    const { violations } = await axe(page).analyze();
    expect(formatViolations(violations)).toBe('');
  });
}

test('the usage report prices idle fuel once a price is set', async ({ page }) => {
  await gotoReady(page, `/reports/usage?deviceId=1&period=today`);
  await page.getByLabel(/מחיר דלק/).fill('7.4');
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  await expect(page.getByRole('main').getByRole('link', { name: 'Delivery Van' })).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByText(/₪\s?\d/)
      .first(),
  ).toBeVisible();
});

// OPS-04: vehicles that barely moved, and what returning one would save.
test('the usage report suggests a smaller fleet', async ({ page }) => {
  await page.route('**/api/reports/trips?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/reports/stops?*', (route) => route.fulfill({ json: [] }));
  const from = new Date();
  from.setDate(from.getDate() - 14);
  await gotoReady(
    page,
    `/reports/usage?deviceId=1&deviceId=2&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`,
  );
  await page.getByLabel(/עלות חודשית לרכב/).fill('3200');
  const note = page.getByRole('alert').filter({ hasText: 'בפחות מ-20% מהימים' });
  await expect(note).toContainText('2 רכבים');
  await expect(note).toContainText(/3,200/);
});
