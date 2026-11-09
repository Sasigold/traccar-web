import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// AI-02: the morning's findings beside the map, with the evidence a click away.
test('the morning findings open, link to their evidence and hide for the day', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/');
  const section = page.getByRole('region', { name: 'תובנות הבוקר' });
  const pill = section.getByRole('button', { name: /תובנות הבוקר/ });
  await expect(pill).toBeVisible({ timeout: 15000 });
  await pill.click();
  await expect(pill).toHaveAttribute('aria-expanded', 'true');
  await expect(section.getByRole('heading').first()).toBeVisible();
  await section.getByRole('button', { name: 'הסתרה להיום' }).click();
  await expect(section).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(page.getByRole('region', { name: 'תובנות הבוקר' })).toHaveCount(0);
});

test('a viewer does not get them', async ({ page }) => {
  await gotoReady(page, '/');
  await page.waitForTimeout(4000);
  await expect(page.getByRole('region', { name: 'תובנות הבוקר' })).toHaveCount(0);
});
