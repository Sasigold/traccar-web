import { test, expect, gotoReady } from './fixtures';

// LIV-12: the map says it is loading and offers a retry when its style does not arrive.
test('a map style that does not load says so and can be retried', async ({ page }) => {
  let block = true;
  await page.route(/tiles\.openfreemap\.org\/styles|\/styles\/.*\.json/, (route) =>
    block ? route.abort('failed') : route.continue(),
  );
  await gotoReady(page, '/');
  const alert = page.getByRole('alert').filter({ hasText: 'טעינת המפה נכשלה' });
  await expect(alert).toBeVisible({ timeout: 25000 });
  block = false;
  await Promise.all([
    page.waitForEvent('load'),
    alert.getByRole('button', { name: 'נסו שוב' }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible({ timeout: 20000 });
});
