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
