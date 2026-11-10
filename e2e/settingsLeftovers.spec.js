import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// ADM-25: technical leftovers in the settings.
test('the vehicles list starts with a few columns, and more are a choice that stays', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a phone shows the list as cards');
  await gotoReady(page, '/settings/devices');
  const headers = page.locator('thead th');
  await expect(headers.filter({ hasText: 'קבוצה' })).toHaveCount(1);
  await expect(headers.filter({ hasText: 'מזהה' })).toHaveCount(0);
  await page.getByRole('button', { name: 'עמודות' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'מזהה' }).click();
  await page.keyboard.press('Escape');
  await expect(headers.filter({ hasText: 'מזהה' })).toHaveCount(1);
  await page.reload();
  await expect(page.locator('thead th').filter({ hasText: 'מזהה' })).toHaveCount(1);
});

test('the device service date is empty when there is no limit', async ({ page }) => {
  await gotoReady(page, '/settings/device/1');
  await expect(page.getByLabel('תוקף שירות המכשיר')).toHaveValue('');
  await expect(page.getByText('השאירו ריק ללא הגבלה', { exact: false })).toBeVisible();
});

test('fields made by the sensors setup are read-only', async ({ page }) => {
  await page.route(/\/api\/attributes\/computed(\?.*)?$/, (route) =>
    route.fulfill({
      json: [
        {
          id: 5,
          description: '[vf:1] ignition ← in2',
          attribute: 'ignition',
          expression: 'in2',
          type: 'boolean',
        },
        {
          id: 6,
          description: 'Fuel liters',
          attribute: 'fuel',
          expression: 'adc1 * 0.1',
          type: 'number',
        },
      ],
    }),
  );
  await gotoReady(page, '/settings/attributes');
  const managed = page.getByRole('row', { name: /ignition ← in2/ });
  await expect(managed.getByText(/נוצר אוטומטית בהגדרת החיישנים/)).toBeVisible();
  await expect(managed.getByText('[vf:1]')).toHaveCount(0);
  await expect(managed.getByRole('button')).toHaveCount(0);
});

test('a notification that is not for every vehicle says which ones', async ({ page }) => {
  await writeMode(page);
  const posts = [];
  await page.route('**/api/notifications', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ json: { ...route.request().postDataJSON(), id: 41 } })
      : route.fallback(),
  );
  await page.route('**/api/permissions', (route) => {
    posts.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/notifications/notificators', (route) =>
    route.fulfill({ json: [{ type: 'web' }] }),
  );
  await gotoReady(page, '/settings/notification');
  await page.getByRole('combobox', { name: 'מתי לשלוח התראה?' }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: 'איך לקבל את ההתראה?' }).click();
  await page.getByRole('option').first().click();
  await page.keyboard.press('Escape');
  const appliesTo = page.getByRole('combobox', { name: 'חל על' });
  await expect(appliesTo).toBeVisible();
  await appliesTo.click();
  await page.getByRole('option', { name: 'Delivery Van' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect.poll(() => posts).toEqual([{ deviceId: expect.any(Number), notificationId: 41 }]);
});

test('sharing makes the link first, then copy or WhatsApp', async ({ page }) => {
  await writeMode(page);
  await page.route('**/api/share/device', (route) => route.fulfill({ body: 'abc123' }));
  await gotoReady(page, '/settings/device/1/share');
  await expect(page.getByRole('link', { name: 'שליחה בוואטסאפ' })).toHaveCount(0);
  await page.getByRole('button', { name: 'יצירת קישור' }).click();
  await expect(page.getByLabel('קישור', { exact: true })).toHaveValue(/\?token=abc123$/);
  await expect(page.getByRole('link', { name: 'שליחה בוואטסאפ' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=.*abc123/,
  );
});
