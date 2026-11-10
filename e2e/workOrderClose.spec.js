import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-19: an order opened from a check's fault is filled from it and takes it over; closing
// asks for the final km, the invoice and the maintenance done (checked by default).
const ORG = 'o1';
const admin = {
  profile: { id: 'p-admin', org_id: ORG, role: 'admin' },
  permissions: ['vehicles.read', 'vehicles.write', 'maintenance.read', 'maintenance.write'],
};

test('a fault becomes an order, and the order is closed from its dialog', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: admin },
    tables: {
      vehicles: [{ id: 'veh1', org_id: ORG, traccar_device_id: 1 }],
      issues: [
        {
          id: 'i1',
          org_id: ORG,
          vehicle_id: 'veh1',
          title: 'רעש בבלמים',
          description: 'נשמע בבלימה חזקה',
          status: 'open',
        },
      ],
    },
  });

  await gotoReady(page, '/fleet/work-order?issue=i1');
  await expect(page.getByLabel('מה עושים')).toHaveValue('רעש בבלמים');
  await page.getByRole('textbox', { name: 'תיאור' }).first().fill('רפידות');
  await page.getByRole('spinbutton', { name: 'מחיר ליחידה' }).first().fill('590');
  await expect(page.getByText(/לפני מע"מ: .*500\.00.*מע"מ: .*90\.00/)).toBeVisible();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page).toHaveURL(/\/fleet\/work-orders$/);
  const [order] = fleet.tables.work_orders;
  expect(fleet.tables.issues[0]).toMatchObject({ work_order_id: order.id, status: 'in_progress' });

  await gotoReady(page, `/fleet/work-order/${order.id}`);
  await page.getByRole('button', { name: 'סגירת הזמנה' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: 'Oil service' })).toBeChecked();
  await dialog.getByLabel('מספר חשבונית').fill('INV-77');
  await dialog.getByRole('button', { name: 'סגירת הזמנה' }).click();
  await expect.poll(() => fleet.tables.work_orders[0].status).toBe('done');
  expect(fleet.tables.work_orders[0]).toMatchObject({
    invoice_number: 'INV-77',
    traccar_maintenance_id: 1,
  });
});
