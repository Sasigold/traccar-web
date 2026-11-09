import { readFile } from 'node:fs/promises';
import { test, expect, gotoReady } from './fixtures';

test('the API page explains the key, the resources and Power BI', async ({ page }) => {
  await gotoReady(page, '/fleet/integrations/api');
  await expect(page.getByText(/\/functions\/v1\/public-api\/v1$/).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '/monthly_costs' })).toBeVisible();

  await page.getByLabel('משאב').click();
  await page.getByRole('option', { name: 'תדלוקים' }).click();
  await expect(page.getByRole('region', { name: 'שאילתת Power Query' })).toContainText(
    'Resource = "fuel"',
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'OpenAPI בעברית' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('viper-fleet-openapi.he.json');
  const spec = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(spec.paths['/fuel'].get.summary).toBe('תדלוקים');
  expect(spec.servers[0].url).toMatch(/\/functions\/v1\/public-api\/v1$/);
});
