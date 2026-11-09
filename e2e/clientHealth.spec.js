import { test, expect, axe, formatViolations, gotoReady, FLEET } from './fixtures';

// FND-06: interface health (platform administrators) and the browser metrics batch.
const overview = [
  {
    release: '1.0.0+bbbbbbb',
    kind: 'vital',
    name: 'LCP',
    samples: 40,
    p75: 2100,
    good: 0.85,
    maximum: 5200,
    orgs: 3,
    last_at: '2026-11-09T10:00:00Z',
  },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'vital',
    name: 'INP',
    samples: 25,
    p75: 640,
    good: 0.4,
    maximum: 900,
    orgs: 3,
    last_at: '2026-11-09T10:00:00Z',
  },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'counter',
    name: 'socket_disconnect',
    samples: 9,
    total: 17,
    maximum: 4,
    orgs: 2,
    last_at: '2026-11-09T09:30:00Z',
  },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'counter',
    name: 'fleet_error.42501',
    samples: 2,
    total: 2,
    maximum: 1,
    orgs: 1,
    last_at: '2026-11-09T08:00:00Z',
  },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'longtask',
    name: 'count',
    samples: 5,
    total: 31,
    maximum: 9,
    orgs: 2,
    last_at: '2026-11-09T10:00:00Z',
  },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'longtask',
    name: 'total_ms',
    samples: 5,
    total: 4200,
    maximum: 1500,
    orgs: 2,
    last_at: '2026-11-09T10:00:00Z',
  },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'longtask',
    name: 'max_ms',
    samples: 5,
    total: 900,
    maximum: 380,
    orgs: 2,
    last_at: '2026-11-09T10:00:00Z',
  },
  {
    release: '1.0.0+aaaaaaa',
    kind: 'vital',
    name: 'LCP',
    samples: 3,
    p75: 4800,
    good: 0,
    maximum: 6000,
    orgs: 1,
    last_at: '2026-11-01T10:00:00Z',
  },
];

const mockFleet = async (page, calls) => {
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
    if (url.includes('/rpc/')) {
      calls.push({ url, headers: request.headers(), body: request.postDataJSON() });
    }
    if (url.includes('/rpc/client_metrics_overview')) return route.fulfill({ json: overview });
    if (url.includes('/rpc/record_client_metrics')) return route.fulfill({ json: 3 });
    return route.fulfill({ json: [] });
  });
};

test('a platform administrator sees the interface health of a release', async ({ page }) => {
  const calls = [];
  await mockFleet(page, calls);
  await gotoReady(page, '/admin/health');

  await expect(page.getByRole('combobox', { name: 'גרסה' })).toContainText('1.0.0+bbbbbbb');
  const lcp = page.getByText('הצגת התוכן הראשי').locator('..').locator('..');
  await expect(lcp).toContainText('2.1 s');
  await expect(lcp).toContainText('LCP · טוב · 85% טובים · 40 מדידות');
  await expect(page.getByText('תגובה ללחיצה').locator('..').locator('..')).toContainText('איטי');
  await expect(page.getByText('אין מדידות בתקופה').first()).toBeVisible();

  await expect(page.getByRole('row', { name: /ניתוקים של החיבור החי/ })).toContainText('17');
  await expect(page.getByRole('row', { name: /שגיאות של מסד הצי/ })).toContainText('42501');
  await expect(page.getByRole('row', { name: /משימות ארוכות/ })).toContainText('31');
  // The demo build has no error service or analytics.
  await expect(page.getByText('דיווח שגיאות: כבוי')).toBeVisible();
  await expect(page.getByText('נתוני שימוש: כבוי')).toBeVisible();

  const { violations } = await axe(page).analyze();
  expect(formatViolations(violations)).toBe('');

  // Another period asks the database again.
  await page.getByRole('combobox', { name: 'תקופה' }).click();
  await page.getByRole('option', { name: '30 הימים האחרונים' }).click();
  await expect
    .poll(() => calls.filter((call) => call.url.includes('client_metrics_overview')).at(-1)?.body)
    .toEqual({ p_days: 30 });

  // An older release.
  await page.getByRole('combobox', { name: 'גרסה' }).click();
  await page.getByRole('option', { name: '1.0.0+aaaaaaa' }).click();
  await expect(page.getByText('הצגת התוכן הראשי').locator('..').locator('..')).toContainText(
    '4.8 s',
  );
  await expect(page.getByText('אין עדיין נתונים בתקופה הזו')).toBeVisible();
});

test('the browser metrics go to the fleet database when the page is hidden', async ({ page }) => {
  const calls = [];
  await mockFleet(page, calls);
  await gotoReady(page, '/');
  await expect.poll(() => calls.some((call) => call.url.includes('touch_last_seen'))).toBe(true);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => calls.find((call) => call.url.includes('record_client_metrics')))
    .toBeTruthy();
  const call = calls.find((item) => item.url.includes('record_client_metrics'));
  expect(call.headers.authorization).toBe('Bearer jwt');
  expect(call.body.p_environment).toBe('demo');
  expect(call.body.p_release).toMatch(/^1\.0\.0\+/);
  // Only templates and numbers: nothing personal in the batch.
  const text = JSON.stringify(call.body.p_metrics);
  expect(text).not.toMatch(/@|token=|jwt/);
  call.body.p_metrics.vitals.forEach((vital) => expect(vital.route).toMatch(/^\/[\w/:-]*$/));
});
