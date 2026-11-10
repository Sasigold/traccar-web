import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// LIV-14: a geofence from the card is a draft until saved; nothing is left behind on cancel.
test('a geofence from the card is created only when saved, and linked to the vehicle', async ({
  page,
  isMobile,
}) => {
  await writeMode(page);
  const posts = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/(geofences|permissions)$/.test(request.url())) {
      posts.push([request.url().split('/api/')[1], request.postDataJSON()]);
    }
  });
  await gotoReady(page, '/');
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  await page.getByText('Delivery Van').first().click();
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await page.getByRole('menuitem', { name: 'יצירת גדר וירטואלית' }).click();
  await expect(page).toHaveURL(/\/settings\/geofence\?latitude=.*deviceId=1/);
  expect(posts).toEqual([]);

  await page.getByLabel('שם').fill('מחסן ראשי');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect.poll(() => posts.map(([path]) => path)).toEqual(['geofences', 'permissions']);
  expect(posts[0][1]).toMatchObject({
    name: 'מחסן ראשי',
    area: expect.stringMatching(/^CIRCLE \(/),
  });
  expect(posts[1][1]).toMatchObject({ deviceId: 1 });
});
