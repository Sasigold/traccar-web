import { test, expect, gotoReady, axe, formatViolations } from './fixtures';

// LIV-17: the live video page explains every state: waiting, connecting, failing, retrying.
test.describe('live video', () => {
  test('a channel, a clear connecting state, a failure with retry, and stop', async ({ page }) => {
    const commands = [];
    await page.route('**/api/commands/send', async (route) => {
      commands.push(JSON.parse(route.request().postData()));
      await route.fulfill({ json: {} });
    });
    let answer = 'hang';
    await page.route('**/api/stream/**', async (route) => {
      if (answer === 'fail') await route.fulfill({ status: 404, body: '' });
      // While "hang": no reply, as a camera that has not started yet.
    });
    await gotoReady(page, '/stream?deviceId=1');

    await expect(page.getByText('בחרו ערוץ ולחצו הפעלה')).toBeVisible();
    const channels = page.getByRole('radiogroup', { name: 'ערוץ מצלמה' });
    await expect(channels.getByRole('radio')).toHaveCount(4);
    await channels.getByRole('radio', { name: 'ערוץ 2' }).click();
    await expect(channels.getByRole('radio', { name: 'ערוץ 2' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const results = await axe(page).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);

    await page.getByRole('button', { name: 'הפעלה' }).click();
    await expect(page.getByRole('status').getByText('מתחברים למצלמה…')).toBeVisible();
    await expect.poll(() => commands.map((c) => c.type)).toContain('videoStart');
    expect(commands[0].attributes).toEqual({ index: 2 });
    // While connected, the channel is fixed and stopping is the secondary, outlined button.
    await expect(channels.getByRole('radio', { name: 'ערוץ 1' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByRole('button', { name: 'עצירה' })).toHaveClass(/MuiButton-outlined/);

    answer = 'fail';
    await page.getByRole('button', { name: 'עצירה' }).click();
    await expect.poll(() => commands.map((c) => c.type)).toContain('videoStop');
    await page.getByRole('button', { name: 'הפעלה' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'לא הצלחנו להתחבר למצלמה' });
    await expect(alert).toBeVisible({ timeout: 20000 });

    // Retry starts the camera again.
    const starts = commands.filter((c) => c.type === 'videoStart').length;
    await alert.getByRole('button', { name: 'נסו שוב' }).click();
    await expect
      .poll(() => commands.filter((c) => c.type === 'videoStart').length)
      .toBeGreaterThan(starts);

    await page.getByRole('button', { name: 'עצירה' }).click();
    await expect(page.getByText('בחרו ערוץ ולחצו הפעלה')).toBeVisible();
  });

  // LIV-17: the four channels at once, two by two.
  test('four channels start together in a grid', async ({ page }) => {
    const commands = [];
    await page.route('**/api/commands/send', async (route) => {
      commands.push(JSON.parse(route.request().postData()));
      await route.fulfill({ json: {} });
    });
    await page.route('**/api/stream/**', () => {});
    await gotoReady(page, '/stream?deviceId=1');
    await page
      .getByRole('group', { name: 'תצוגה' })
      .getByRole('button', { name: 'ארבעה ערוצים' })
      .click();
    await expect(page.getByRole('radiogroup', { name: 'ערוץ מצלמה' })).toHaveCount(0);
    await page.getByRole('button', { name: 'הפעלה' }).click();
    for (const index of [1, 2, 3, 4]) {
      await expect(page.getByRole('group', { name: `ערוץ ${index}` })).toBeVisible();
    }
    await expect
      .poll(() =>
        commands
          .filter((c) => c.type === 'videoStart')
          .map((c) => c.attributes.index)
          .sort(),
      )
      .toEqual([1, 2, 3, 4]);
    await page.getByRole('button', { name: 'עצירה' }).click();
    await expect.poll(() => commands.filter((c) => c.type === 'videoStop').length).toBe(4);
  });
});
