import { test, expect, gotoReady } from './fixtures';

test('the operations dashboard opens with what needs attention, most urgent first', async ({
  page,
}) => {
  await gotoReady(page, '/dashboard');
  const widget = page.getByRole('region', { name: 'צריך טיפול עכשיו' });
  const first = widget.getByRole('link').first();
  await expect(first).toContainText('דחוף');
  await expect(first).toContainText('התוקף פג');
  await widget.getByRole('link', { name: /Delivery Van.*ביטוח/ }).click();
  await expect(page).toHaveURL(/\/fleet\/vehicle\/1\?tab=documents/);
});
