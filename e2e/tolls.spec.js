import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ISR-06: a toll statement is matched to the trips and the drivers.
test('a toll statement is matched to trips and drivers', async ({ page }) => {
  const at = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const ddmm = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  await page.route('**/api/reports/trips?*', (route) =>
    route.fulfill({
      json: [
        {
          deviceId: 1,
          driverUniqueId: 'drv1',
          startTime: at(8, 0).toISOString(),
          endTime: at(9, 0).toISOString(),
        },
      ],
    }),
  );
  await gotoReady(page, '/reports/tolls');
  const csv = [
    'תאריך ושעה,מספר רכב,קטע,סכום לתשלום',
    `${ddmm(at(8, 30))},12-345-67,כביש 6,18.90`,
    `${ddmm(at(8, 30))},99-999-99,חניון,7`,
  ].join('\n');
  await page.locator('input[type=file]').setInputFiles({
    name: 'road6.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('הותאם לנסיעה')).toBeVisible();
  await expect(page.getByText('רכב לא מוכר')).toBeVisible();
  await expect(page.getByRole('status', { name: 'סכום לפי נהג' })).toContainText('18.90');
});

// ISR-06: the statement is saved once, a charge is marked private (the driver pays it), and the
// company's totals go by cost center.
test('a toll statement is saved, with private use and cost centers', async ({ page }) => {
  await writeMode(page);
  const at = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const ddmm = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  await page.route('**/api/reports/trips?*', (route) => route.fulfill({ json: [] }));
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['costs.read', 'costs.write'],
      },
    },
    tables: {
      toll_charges: [],
      vehicles: [
        {
          id: 'v1',
          org_id: 'o1',
          plate_number: '12-345-67',
          cost_center: 'מכירות',
          traccar_device_id: 1,
        },
      ],
    },
  });
  await gotoReady(page, '/reports/tolls');
  const csv = [
    'תאריך ושעה,מספר רכב,קטע,סכום לתשלום',
    `${ddmm(at(8, 30))},12-345-67,כביש 6,18.90`,
    `${ddmm(at(18, 10))},12-345-67,כביש 6,22.00`,
  ].join('\n');
  await page.locator('input[type=file]').setInputFiles({
    name: 'road6-nov.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByRole('status', { name: 'לפי מרכז עלות' })).toContainText('מכירות');
  await page.getByRole('checkbox', { name: /פרטי: 12-345-67 .*18:10/ }).check();
  await expect(page.getByRole('status', { name: 'סכום לפי נהג' })).toContainText('פרטי');
  await page.getByRole('button', { name: 'שמירת הדוח' }).click();

  await expect.poll(() => fleet.tables.toll_charges.length).toBe(2);
  const evening = fleet.tables.toll_charges.find((row) => Number(row.amount) === 22);
  expect(evening).toMatchObject({
    org_id: 'o1',
    vehicle_id: 'v1',
    private: true,
    cost_center: 'מכירות',
    statement: 'road6-nov.csv',
  });
  // Back on the saved charges.
  await expect(page.getByRole('button', { name: 'שמירת הדוח' })).toBeHidden();
  await expect(page.getByRole('checkbox', { name: /פרטי: 12-345-67/ })).toHaveCount(2);
});
