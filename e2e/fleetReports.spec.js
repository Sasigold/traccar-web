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
