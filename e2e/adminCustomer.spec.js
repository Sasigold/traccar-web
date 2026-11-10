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
