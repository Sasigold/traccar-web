import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-18: a fueling paid in cash, an anomaly someone checked, and an import that can be undone
// and that remembers the company's columns.
const accountant = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['costs.read', 'costs.write', 'vehicles.read'],
};

const openFuel = async (page) => {
  await gotoReady(page, '/fleet/costs');
  await page.getByRole('button', { name: 'דלק', exact: true }).click();
};

test('a manual fueling is saved with the suggested odometer', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: accountant },
    tables: {
      vehicles: [{ id: 'veh1', org_id: 'o1', traccar_device_id: 1 }],
      fuel_transactions: [],
    },
  });
  await openFuel(page);
  await page.getByRole('button', { name: 'תדלוק ידני' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('רכב').click();
  await page.getByRole('option', { name: 'Delivery Van' }).click();
  await dialog.getByLabel('ליטרים').fill('40');
  await dialog.getByLabel('סכום').fill('280');
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect.poll(() => fleet.tables.fuel_transactions.length).toBe(1);
  expect(fleet.tables.fuel_transactions[0]).toMatchObject({
    vehicle_id: 'veh1',
    source: 'manual',
    liters: 40,
    total: 280,
    unit_price: 7,
  });
});

test('an anomaly marked as checked keeps who checked it', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: accountant },
    tables: {
      fuel_transactions: [
        {
          id: 'f1',
          org_id: 'o1',
          occurred_at: new Date().toISOString(),
          total: 900,
          liters: 120,
          anomaly_flags: ['over_capacity'],
        },
      ],
    },
  });
  await openFuel(page);
  await page.getByRole('button', { name: 'בדקתי, תקין' }).click();
  await expect.poll(() => fleet.tables.fuel_transactions[0].reviewed_by).toBe('p1');
});

test('an import remembers the company columns and can be undone', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: accountant },
    tables: { fuel_transactions: [], fuel_import_profiles: [], vehicles: [] },
  });
  await openFuel(page);
  await page.getByRole('button', { name: 'ייבוא קובץ דלק' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('חברת דלק').click();
  await page.getByRole('option', { name: 'פז' }).click();
  const csv = 'תאריך,סכום לתשלום,אסמכתא\n2026-11-01 08:00,250,A1\n2026-11-02 09:30,180,A2\n';
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'paz.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await dialog.getByRole('button', { name: /ייבוא 2/ }).click();
  await expect.poll(() => fleet.tables.fuel_transactions.length).toBe(2);
  expect(fleet.tables.fuel_import_profiles[0]).toMatchObject({
    provider: 'paz',
    mapping: { occurred_at: 'תאריך', total: 'סכום לתשלום', external_id: 'אסמכתא' },
  });
  await dialog.getByRole('button', { name: 'ביטול הייבוא' }).click();
  await expect(dialog.getByText('הייבוא בוטל')).toBeVisible();
  expect(fleet.tables.fuel_transactions).toHaveLength(0);
});

// ADM-18: the summary shows ₪/km from the distance driven, a vehicle opens its own rows, and an
// expense row is edited in place.
test('the summary costs per km, opens a vehicle and edits its expense', async ({ page }) => {
  await writeMode(page);
  const month = new Date();
  month.setDate(1);
  const fleet = await fakeFleet(page, {
    users: { 1: accountant },
    tables: {
      vehicles: [
        { id: 'veh1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' },
        { id: 'veh2', org_id: 'o1', traccar_device_id: 2, plate_number: '76-543-21' },
      ],
      vehicle_monthly_costs: [
        {
          vehicle_id: 'veh1',
          month: month.toISOString().slice(0, 10),
          category: 'toll',
          amount: 500,
        },
      ],
      vehicle_expenses: [
        {
          id: 'e1',
          org_id: 'o1',
          vehicle_id: 'veh1',
          category: 'toll',
          occurred_at: new Date().toISOString().slice(0, 10),
          amount: 500,
        },
        {
          id: 'e2',
          org_id: 'o1',
          vehicle_id: 'veh2',
          category: 'parking',
          occurred_at: new Date().toISOString().slice(0, 10),
          amount: 40,
        },
      ],
    },
  });
  await page.route('**/api/reports/summary?*', (route) =>
    route.fulfill({ json: [{ deviceId: 1, distance: 250000 }] }),
  );
  await gotoReady(page, '/fleet/costs');
  const row = page.getByRole('row').filter({ hasText: '12-345-67' });
  // 500 ₪ over 250 km.
  await expect(row).toContainText('2');
  await expect(row.getByRole('cell').last()).toHaveText(/2(\.00)?/);

  await row.getByRole('button', { name: 'התדלוקים וההוצאות של 12-345-67' }).click();
  await expect(page.getByRole('button', { name: 'הוצאות', exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '76-543-21' })).toHaveCount(0);
  await page
    .getByRole('row')
    .filter({ hasText: '12-345-67' })
    .getByRole('button', { name: 'עריכה' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'עריכת הוצאה' });
  await dialog.getByLabel('סכום').fill('550');
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect.poll(() => fleet.tables.vehicle_expenses[0].amount).toBe(550);
  expect(fleet.tables.vehicle_expenses).toHaveLength(2);
});

// ADM-18: a plate the file names that matches no vehicle is mapped by hand, and remembered.
test('an unknown plate in the import is mapped to a vehicle', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: accountant },
    tables: { fuel_transactions: [], fuel_import_profiles: [], vehicles: [] },
  });
  await openFuel(page);
  await page.getByRole('button', { name: 'ייבוא קובץ דלק' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('חברת דלק').click();
  await page.getByRole('option', { name: 'פז' }).click();
  const csv = 'תאריך,מספר רכב,סכום לתשלום\n2026-11-01 08:00,99-888-77,250\n';
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'paz.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(dialog.getByText('מספרי רישוי שלא זוהו')).toBeVisible();
  await dialog.getByLabel('הרכב של 99-888-77').click();
  await page.getByRole('option', { name: 'Delivery Van' }).click();
  await dialog.getByRole('button', { name: /ייבוא 1/ }).click();
  await expect.poll(() => fleet.tables.fuel_transactions.length).toBe(1);
  expect(fleet.tables.fuel_transactions[0].vehicle_id).toBeTruthy();
  expect(fleet.tables.fuel_transactions[0].anomaly_flags || []).not.toContain('unknown_vehicle');
  await expect
    .poll(() => fleet.tables.fuel_import_profiles[0]?.mapping?.plates)
    .toEqual({ 9988877: 1 });
});
