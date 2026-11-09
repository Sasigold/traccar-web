import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';

test('a report is scheduled from a visible button and listed in plain words', async ({ page }) => {
  // The demo is read-only; scheduling is for users who may change things.
  for (const path of ['**/api/session', '**/api/server']) {
    await page.route(path, async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fallback();
      }
      const response = await route.fetch();
      return route.fulfill({ response, json: { ...(await response.json()), readonly: false } });
    });
  }
  const writes = [];
  let calendar = null;
  let report = null;
  await page.route('**/api/calendars', (route) => {
    if (route.request().method() === 'POST') {
      calendar = { id: 31, ...route.request().postDataJSON() };
      writes.push({ path: 'calendars', body: calendar });
      return route.fulfill({ json: calendar });
    }
    return route.fulfill({ json: calendar ? [calendar] : [] });
  });
  await page.route('**/api/reports', (route) => {
    if (route.request().method() === 'POST') {
      report = { id: 41, ...route.request().postDataJSON() };
      writes.push({ path: 'reports', body: report });
      return route.fulfill({ json: report });
    }
    return route.fulfill({ json: report ? [report] : [] });
  });
  await page.route('**/api/permissions/bulk', (route) => {
    writes.push({ path: 'permissions', body: route.request().postDataJSON() });
    return route.fulfill({ status: 204 });
  });

  await gotoReady(page, '/reports/trips?deviceId=1');
  await page.getByRole('button', { name: 'שליחה קבועה במייל' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('שם')).toHaveValue('נסיעות');
  await dialog.getByRole('button', { name: 'כל שבוע' }).click();
  await dialog.getByLabel('בשעה').click();
  await page.getByRole('option', { name: '08:00' }).click();
  await dialog.getByRole('button', { name: 'שמירה' }).click();

  await expect(page).toHaveURL(/\/reports\/scheduled$/);
  const ical = Buffer.from(
    writes.find((write) => write.path === 'calendars').body.data,
    'base64',
  ).toString();
  expect(ical).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
  expect(writes.find((write) => write.path === 'reports').body).toMatchObject({
    type: 'trips',
    description: 'נסיעות',
    calendarId: 31,
  });
  expect(writes.find((write) => write.path === 'permissions').body).toEqual([
    { deviceId: 1, reportId: 41 },
  ]);
  await expect(page.getByRole('cell', { name: 'כל יום ראשון ב־08:00' })).toBeVisible();
});
