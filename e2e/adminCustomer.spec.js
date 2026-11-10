import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-26: the customer's tab is in the address, and suspending a customer offers to disable its
// users (suspending alone did nothing).
const platformAdmin = {
  profile: { id: 'p0', org_id: 'o0', role: 'owner' },
  permissions: ['customers.read', 'customers.manage'],
};

test('a suspended customer can have its users disabled in the same step', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the same form on a phone');
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: platformAdmin },
    tables: {
      customers: [{ id: 'c1', name: 'הובלות הצפון', status: 'active' }],
      customer_users: [{ customer_id: 'c1', traccar_user_id: 2, is_primary: true }],
      device_registry: [],
      customer_device_counts: [],
    },
  });
  const disabled = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith('/api/users/2')) {
      disabled.push(request.postDataJSON().disabled);
    }
  });

  await gotoReady(page, '/admin/customer/c1?tab=users');
  await expect(page.getByRole('tab', { name: 'משתמשים' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'פרטי לקוח' }).click();
  await expect(page).toHaveURL(/\/admin\/customer\/c1$/);

  await page.getByLabel('סטטוס').click();
  await page.getByRole('option', { name: 'מושעה' }).click();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('1 משתמשים פעילים');
  await dialog.getByRole('button', { name: 'השבתת המשתמשים' }).click();
  await expect.poll(() => disabled).toEqual([true]);
});

test('a device opened after setup shows its first report', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: platformAdmin },
    tables: { customers: [], customer_users: [], device_registry: [], customer_device_counts: [] },
  });
  await gotoReady(page, '/admin/device/1?check=1');
  await expect(page.getByRole('status').filter({ hasText: 'התקבל דיווח ב-' })).toBeVisible();
});

// ADM-26: the wizard's steps stay on top with ✓ and !, and the vehicle step fills from the
// government registry by the plate.
test('the device wizard shows its steps and fills the vehicle from the registry', async ({
  page,
}) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: platformAdmin },
    tables: { customers: [], customer_users: [], device_registry: [], customer_device_counts: [] },
  });
  await page.route('https://data.gov.il/api/3/action/package_show**', (route) =>
    route.fulfill({
      json: { success: true, result: { resources: [{ id: 'r1', datastore_active: true }] } },
    }),
  );
  await page.route('https://data.gov.il/api/3/action/datastore_search**', (route) =>
    route.fulfill({
      json: {
        success: true,
        result: {
          records: [
            {
              mispar_rechev: 75128203,
              tozeret_nm: "מ.ג'י סין",
              kinuy_mishari: 'ZS',
              shnat_yitzur: 2025,
              tokef_dt: '2027-01-06',
            },
          ],
        },
      },
    }),
  );
  await gotoReady(page, '/admin/device');
  const steps = page.getByRole('navigation', { name: 'שלבי ההתקנה' });
  await expect(steps.getByRole('link', { name: '1. המכשיר · חסר' })).toBeVisible();
  await page.getByLabel('שם הרכב / המכשיר').fill('ואן 7');
  await page.getByLabel('IMEI / מזהה').fill('861234567890123');
  await expect(steps.getByRole('link', { name: '1. המכשיר · הושלם' })).toBeVisible();

  await steps.getByRole('link', { name: /^4\./ }).click();
  await page.getByLabel('מספר רישוי').fill('751-28-203');
  await page.getByRole('button', { name: 'מילוי מהמאגר הממשלתי' }).click();
  await page
    .getByRole('dialog', { name: 'פרטי הרכב במאגר משרד התחבורה' })
    .getByRole('button', { name: 'עדכון הכרטיס' })
    .click();
  await expect(steps.getByRole('link', { name: /^4\. .* · הושלם$/ })).toBeVisible();
});
