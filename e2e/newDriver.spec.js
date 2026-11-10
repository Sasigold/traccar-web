import { test, expect, gotoReady } from './fixtures';

// ISR-12: a driver is "new" for two years from the license issue date, with the escort period.
test('new drivers are tagged in the list and on their card', async ({ page }) => {
  await gotoReady(page, '/settings/drivers');
  const row = page.getByRole('row', { name: /Noa Mizrahi/ });
  await expect(row.getByLabel(/^נהג חדש: נהג חדש עד .*חובת ליווי בלילה/)).toBeVisible();
  await expect(page.getByRole('row', { name: /דנה לוי/ }).getByLabel(/^נהג חדש/)).toHaveCount(0);

  await gotoReady(page, '/settings/driver/3');
  await expect(page.getByLabel('תאריך הוצאת הרישיון')).not.toHaveValue('');
  await expect(page.getByText('נהג חדש · בליווי')).toBeVisible();
});

test('a vehicle can be marked as not for new drivers', async ({ page }) => {
  await gotoReady(page, '/settings/device/1');
  const toggle = page.getByRole('switch', { name: 'לא לנהגים חדשים' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
});
