import { test, expect, gotoReady, axe, formatViolations } from './fixtures';

// The demo sends a live event to this page only (matched by the demoClient cookie).
const openWithClient = async (page, context) => {
  const client = `t${Math.random().toString(36).slice(2)}`;
  await context.addCookies([{ name: 'demoClient', value: client, url: 'http://localhost:3000' }]);
  await gotoReady(page, '/');
  // Sends once the page's live connection is up (the demo reports how many pages got it).
  return async (query) => {
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/demo/event?client=${client}&${query}`);
        return (await response.json()).sent;
      })
      .toBeGreaterThan(0);
  };
};

test.describe('alerts', () => {
  test('a critical alert stays on top until acknowledged and opens on the map', async ({
    page,
    context,
  }) => {
    const send = await openWithClient(page, context);
    await send('deviceId=1&type=alarm&alarm=sos');

    const banner = page.getByRole('alert').filter({ hasText: 'Delivery Van' });
    await expect(banner).toBeVisible();
    const { violations } = await axe(page).include('[role=alert]').analyze();
    expect(formatViolations(violations)).toBe('');

    await banner.getByRole('button', { name: 'הצגה במפה' }).click();
    // The card shows the alert with its place and a replay around it.
    await expect(page.getByRole('button', { name: 'מיקום ההתראה' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'שחזור סביב ההתראה' })).toBeVisible();
    await expect(banner).toBeVisible();

    await banner.getByRole('button', { name: 'אישור' }).click();
    await expect(banner).toHaveCount(0);
  });

  test('a warning shows a notice, the bell counts it until the list is opened', async ({
    page,
    context,
  }) => {
    const send = await openWithClient(page, context);
    await send('deviceId=2&type=deviceOverspeed&speed=60');
    await expect(page.getByRole('alert').filter({ hasText: 'Service Van' })).toBeVisible();
    const bell = page.getByRole('button', { name: /התראות \(1 חדשות\)/ });
    await expect(bell).toBeVisible();

    await bell.click();
    const list = page.getByRole('dialog', { name: 'התראות' });
    await expect(list.getByText('Service Van')).toBeVisible();
    const { violations } = await axe(page).include('[role=dialog]').analyze();
    expect(formatViolations(violations)).toBe('');
    await list.getByRole('button', { name: 'סגירה' }).click();
    // Seen: the count is gone.
    const quietBell = page.getByRole('button', { name: 'התראות', exact: true });
    await expect(quietBell).toBeVisible();
    await quietBell.click();

    // Clearing can be undone.
    await list.getByRole('button', { name: 'ניקוי הכול' }).click();
    await expect(list.getByText('Service Van')).toHaveCount(0);
    await expect(list.getByRole('status')).toHaveText(/התראה אחת נוקתה/);
    await list.getByRole('button', { name: 'ביטול' }).click();
    await expect(list.getByText('Service Van')).toBeVisible();

    // Opening an alert selects the vehicle and shows the alert on its card.
    await list.getByText('Service Van').click();
    await expect(page.getByRole('button', { name: 'שחזור סביב ההתראה' })).toBeVisible();
  });
});
