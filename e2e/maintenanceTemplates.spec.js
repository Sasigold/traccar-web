import { test, expect, gotoReady } from './fixtures';

// ADM-31: a new maintenance starts from a common plan: name, kind and interval filled in.
test('a maintenance plan starts from a template', async ({ page }) => {
  await gotoReady(page, '/settings/maintenance');
  await page.getByRole('button', { name: 'טיפול כל 15,000 ק"מ' }).click();
  await expect(page.getByRole('textbox', { name: 'שם' })).toHaveValue('טיפול כל 15,000 ק"מ');
  await expect(page.getByRole('spinbutton', { name: /מרווח/ })).toHaveValue('15000');
  const saved = page.waitForRequest(
    (request) => request.method() === 'POST' && /\/api\/maintenance$/.test(request.url()),
  );
  await page.getByRole('button', { name: 'שמירה' }).first().click();
  const body = (await saved).postDataJSON();
  expect(body).toMatchObject({ type: 'totalDistance', start: 15000000, period: 15000000 });

  // A yearly plan counts days from today.
  await gotoReady(page, '/settings/maintenance');
  await page.getByRole('button', { name: 'טיפול שנתי' }).click();
  await expect(page.getByRole('spinbutton', { name: /מרווח/ })).toHaveValue('365');
});
