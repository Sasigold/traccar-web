import { test, expect, gotoReady } from './fixtures';

// LIV-09: on a tablet on its side the rail starts folded, so the map keeps its room; opening it
// is remembered.
test('the rail starts folded on a tablet and remembers being opened', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a phone has the tab bar');
  await page.setViewportSize({ width: 1180, height: 820 });
  await gotoReady(page, '/');
  const rail = page.getByRole('navigation', { name: 'ניווט' });
  await expect(rail.getByRole('button', { name: 'הרחבת התפריט' })).toBeVisible();
  await rail.getByRole('button', { name: 'הרחבת התפריט' }).click();
  await expect(rail.getByRole('button', { name: 'כיווץ התפריט' })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('navigation', { name: 'ניווט' }).getByRole('button', { name: 'כיווץ התפריט' }),
  ).toBeVisible();
});
