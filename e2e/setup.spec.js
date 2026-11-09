import { test, expect, gotoReady } from './fixtures';

const FLEET = 'https://viper-fleet-api.srv2122641.hstgr.cloud';

// Counts come back as HEAD requests with a Content-Range header, as PostgREST answers them.
const mockFleet = async (page, counts) => {
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o1', role: 'owner' },
          permissions: ['vehicles.read', 'users.read', 'alerts.manage', 'inspections.write'],
        },
      });
    }
    const name = url.pathname.split('/').at(-1);
    if (request.method() === 'HEAD') {
      const count = counts[name] ?? 0;
      return route.fulfill({
        status: 200,
        headers: {
          'content-range': `0-0/${count}`,
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-range',
        },
        body: '',
      });
    }
    return route.fulfill({ json: [] });
  });
};

test('a new account sees its setup steps, continues with the next one and can hide the card', async ({
  page,
}) => {
  await mockFleet(page, { profiles: 1 });
  await gotoReady(page, '/fleet');
  const card = page.getByRole('region', { name: 'הקמת הצי' });
  await expect(card).toBeVisible();
  // The demo has vehicles, drivers and maintenance; nothing in the fleet database yet.
  await expect(card).toContainText('3 מתוך 7 שלבים הושלמו');
  const next = card.getByRole('link', { name: 'המשך: שיוך נהג לרכב' });
  await expect(next).toHaveAttribute('href', '/settings/drivers');
  await expect(card.getByRole('link', { name: 'מי מקבל התראות' })).toHaveAttribute(
    'href',
    '/fleet/alerts',
  );

  await card.getByRole('button', { name: 'הסתרת כרטיס ההקמה' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'צי' }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'הקמת הצי' })).toHaveCount(0);
});

test('the card is gone once every step is done', async ({ page }) => {
  await mockFleet(page, {
    vehicle_driver_assignments: 2,
    profiles: 3,
    alert_recipients: 1,
    inspection_templates: 1,
  });
  await gotoReady(page, '/fleet');
  await expect(page.getByRole('link', { name: /פגי תוקף/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('region', { name: 'הקמת הצי' })).toHaveCount(0);
});
