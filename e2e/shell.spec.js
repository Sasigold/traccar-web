import { test, expect, gotoReady } from './fixtures';

// LIV-16: a skip link first, a title per screen, and the focus on the new screen's title.
test('skip to content, a page title, and focus on the title after moving', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard');
  await gotoReady(page, '/');
  await expect(page).toHaveTitle('מפה חיה · viper fleet');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'דילוג לתוכן' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page
    .getByRole('navigation', { name: 'ניווט' })
    .getByRole('link', { name: 'דוחות' })
    .click();
  await expect(page).toHaveTitle(/ · viper fleet$/);
  await expect(page.locator('#main-content h1')).toBeFocused();
});

// LIV-16: resting on a navigation item starts loading that screen.
test('hovering a navigation item loads its screen ahead', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the rail is a desktop navigation');
  await gotoReady(page, '/');
  const request = page.waitForRequest(/DashboardPage/);
  await page.getByRole('navigation').getByRole('link', { name: 'דשבורד' }).hover();
  await request;
});
