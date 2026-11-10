import { test, expect, gotoReady } from './fixtures';

// REP-10: results made for another filter are dimmed, with a bar to update them.
const day = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

test('a changed filter dims the results until they are updated', async ({ page }) => {
  await gotoReady(page, `/reports/trips?deviceId=1&${day()}`);
  const bar = page.getByRole('status').filter({ hasText: 'הסינון השתנה' });
  await expect(page.getByRole('table')).toBeVisible();
  await expect(bar).toHaveCount(0);

  await page.getByRole('combobox', { name: 'תקופה' }).click();
  await page.getByRole('option', { name: 'אתמול' }).click();
  await expect(bar).toBeVisible();
  // The filter's header is marked, and what follows it (totals, table) is dimmed.
  await expect(page.locator('[data-stale="true"]')).toHaveCount(1);

  const before = new URL(page.url()).searchParams.get('from');
  await bar.getByRole('button', { name: 'עדכון התוצאות' }).click();
  await expect(bar).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('from')).not.toBe(before);
});
