import { test, expect, gotoReady } from './fixtures';

// REP-20: the dashboard on a control-room screen (?tv=1 works without full screen too).
test('the TV board shows its name, period, clock and the time it was updated', async ({ page }) => {
  await gotoReady(page, '/dashboard?tv=1');
  const header = page.locator('header').filter({ hasText: 'עודכן' }).last();
  await expect(header).toBeVisible();
  await expect(header).toContainText(/\d{2}:\d{2}/);
  await expect(header).toContainText('היום');
  // The dashboard filters and tabs are not on the TV board.
  await expect(page.getByRole('button', { name: 'התאמה אישית' })).toHaveCount(0);
  await page.getByRole('button', { name: 'יציאה ממצב טלוויזיה' }).click();
  await expect(page).not.toHaveURL(/tv=1/);
  await expect(page.getByRole('button', { name: 'התאמה אישית' })).toBeVisible();
});

test('the screen is kept awake while the board shows', async ({ page }) => {
  await page.addInitScript(() => {
    window.wakeRequests = 0;
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async () => {
          window.wakeRequests += 1;
          return { release: async () => {} };
        },
      },
    });
  });
  await gotoReady(page, '/dashboard?tv=1');
  await expect.poll(() => page.evaluate(() => window.wakeRequests)).toBeGreaterThan(0);
});
