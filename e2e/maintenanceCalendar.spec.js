import { test, expect, gotoReady, axe, formatViolations } from './fixtures';

// ADM-31: the maintenance plans on a month calendar, with the overdue ones listed above it.
test('the maintenance plans show on a month calendar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the phone shows an agenda instead');
  await gotoReady(page, '/settings/maintenances');
  const summary = page.waitForRequest((request) => request.url().includes('/api/reports/summary'));
  await page.getByRole('button', { name: 'לוח שנה' }).click();
  // The pace of every vehicle comes from one summary request.
  expect(new URL((await summary).url()).searchParams.getAll('deviceId').length).toBeGreaterThan(1);

  const month = page.getByRole('list', { name: /\d{4}/ });
  await expect(month).toBeVisible();
  await expect(month.getByRole('listitem')).toHaveCount(42);
  await expect(page.getByText(/תחזית לפי הנסיעה ב-30 הימים האחרונים/)).toBeVisible();

  const title = await page.getByRole('heading', { level: 2 }).textContent();
  await page.getByRole('button', { name: 'החודש הבא' }).click();
  await expect(page.getByRole('heading', { level: 2 })).not.toHaveText(title);
  await page.getByRole('button', { name: 'החודש', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(title);

  const results = await axe(page).analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

test('the calendar is an agenda on the phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReady(page, '/settings/maintenances');
  await page.getByRole('button', { name: 'לוח שנה' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(page.getByRole('list', { name: /\d{4}/ })).toHaveCount(0);
});
