import { test, expect, axe, formatViolations, gotoReady } from './fixtures';

const FLEET = 'https://viper-fleet-api.srv2122641.hstgr.cloud';

const overview = [
  {
    org_id: 'o1',
    name: 'הובלות הצפון',
    per_minute: 60,
    per_day: 20000,
    custom: false,
    active_keys: 2,
    used_day: 1534,
  },
];

// A platform administrator: an administrator in Traccar and customers.manage in the fleet database.
const mockAdmin = async (page, writes) => {
  await page.route('**/api/session', async (route) => {
    const response = await route.fetch();
    const user = await response.json();
    await route.fulfill({ response, json: { ...user, administrator: true, readonly: false } });
  });
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o0', role: 'owner' },
          permissions: ['customers.read', 'customers.manage'],
        },
      });
    }
    if (url.includes('/rpc/api_limits_overview')) return route.fulfill({ json: overview });
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), url, body: request.postDataJSON() });
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ json: [] });
  });
};

test("a platform administrator sets an organization's API package limit", async ({ page }) => {
  const writes = [];
  await mockAdmin(page, writes);
  await gotoReady(page, '/admin/api');
  const row = page.getByRole('row', { name: /הובלות הצפון/ });
  await expect(row.getByText('ברירת מחדל')).toBeVisible();
  await expect(row.getByRole('cell', { name: '1,534' })).toBeVisible();
  const { violations } = await axe(page).analyze();
  expect(formatViolations(violations)).toBe('');

  await row.getByRole('button', { name: 'עריכת מגבלה: הובלות הצפון' }).click();
  const dialog = page.getByRole('dialog', { name: 'הובלות הצפון' });
  await dialog.getByLabel('בקשות בדקה').fill('0');
  await expect(dialog.getByRole('button', { name: 'שמירה' })).toBeDisabled();
  await dialog.getByLabel('בקשות בדקה').fill('300');
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  const write = writes.find((item) => item.url.includes('/rest/v1/api_limits'));
  expect(write.method).toBe('POST');
  expect(write.body).toMatchObject({ org_id: 'o1', per_minute: 300, per_day: 20000 });
});
