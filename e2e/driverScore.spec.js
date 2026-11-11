import { test, expect, gotoReady, FLEET, axe, formatViolations } from './fixtures';

// SAF-05, SEC-23: the driver sees their own score, badges and events, and disagrees with one.
const day = (offset, hour) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const trips = [
  { deviceId: 1, startTime: day(0, 8), endTime: day(0, 9), distance: 60000 },
  { deviceId: 1, startTime: day(1, 8), endTime: day(1, 9), distance: 60000 },
  { deviceId: 1, startTime: day(2, 8), endTime: day(2, 9), distance: 60000 },
];
const events = [
  {
    id: 7001,
    deviceId: 1,
    type: 'deviceOverspeed',
    eventTime: day(2, 8.5),
    attributes: { speed: 70 },
  },
];

const mockFleet = async (page) => {
  const calls = [];
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route('**/api/reports/trips?*', (route) => route.fulfill({ json: trips }));
  await page.route('**/api/reports/events?*', (route) => route.fulfill({ json: events }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split('/').at(-1);
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    if (name === 'traccar-auth') {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o1', role: 'driver' },
          permissions: ['incidents.write', 'inspections.write'],
        },
      });
    }
    if (name === 'driver_my_periods') {
      return route.fulfill({
        json: [
          { traccar_device_id: 1, plate_number: '12-345-67', starts_at: day(40, 0), ends_at: null },
        ],
      });
    }
    if (name === 'safety_driver_dispute') {
      calls.push(request.postDataJSON());
      return route.fulfill({ status: 204, body: '' });
    }
    if (name === 'drivers') {
      const row = { id: 'd1', full_name: 'דנה לוי' };
      return route.fulfill({ json: single ? row : [row] });
    }
    if (single) {
      return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
    }
    return route.fulfill({ json: [] });
  });
  return calls;
};

test('a driver sees their score and disagrees with an event', async ({ page }) => {
  const calls = await mockFleet(page);
  await gotoReady(page, '/driver');
  const card = page
    .getByRole('heading', { name: 'הציון שלי' })
    .locator('xpath=ancestor::*[contains(@class,"MuiPaper")][1]');
  await expect(card).toBeVisible();
  await expect(card.getByText('מהירות', { exact: true })).toBeVisible();
  await expect(card.getByText('12-345-67')).toBeVisible();

  await card.getByRole('button', { name: 'ערעור על האירוע' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'לא אני נהגתי' }).check();
  await dialog.getByRole('textbox', { name: /פירוט/ }).fill('הרכב היה אצל יוסי');
  await dialog.getByRole('button', { name: 'שליחה' }).click();
  await expect(dialog).toBeHidden();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    p_event: 7001,
    p_device: 1,
    p_category: 'overspeed',
    p_reason: 'not_me',
    p_note: 'הרכב היה אצל יוסי',
  });

  const results = await axe(page).analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});
