import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// OPS-06: a pool vehicle is booked, approved by a manager and returned with its odometer.
test('a pool vehicle is booked, approved and returned', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager', full_name: 'דנה' },
        permissions: ['vehicles.read', 'pool.manage'],
      },
    },
    rpc: { fleet_features: ['pool'] },
    tables: {
      vehicles: [
        { id: 'v1', org_id: 'o1', plate_number: '12-345-67', pool: true },
        { id: 'v2', org_id: 'o1', plate_number: '76-543-21', pool: false },
      ],
      pool_bookings: [],
      profiles: [{ id: 'p1', org_id: 'o1', full_name: 'דנה' }],
    },
  });
  await gotoReady(page, '/fleet/pool');
  await page.getByRole('button', { name: 'הזמנת רכב' }).click();
  const dialog = page.getByRole('dialog', { name: 'הזמנת רכב' });
  await dialog.getByLabel('יעד').fill('חיפה');
  await dialog.getByRole('button', { name: 'שליחת בקשה' }).click();
  await expect.poll(() => fleet.tables.pool_bookings.length).toBe(1);
  expect(fleet.tables.pool_bookings[0]).toMatchObject({ vehicle_id: 'v1', destination: 'חיפה' });

  // The fake database does not run the trigger: the request is shown as the server would store it.
  fleet.tables.pool_bookings[0].status = 'requested';
  fleet.tables.pool_bookings[0].requested_by = 'p1';
  await page.reload();
  await page.getByRole('button', { name: 'אישור' }).click();
  await expect.poll(() => fleet.tables.pool_bookings[0].status).toBe('approved');
  await page.getByRole('button', { name: 'החזרת הרכב' }).click();
  const back = page.getByRole('dialog', { name: 'החזרת הרכב' });
  await back.getByLabel('מד ק"מ בהחזרה').fill('45210');
  await back.getByRole('button', { name: 'החזרת הרכב' }).click();
  await expect.poll(() => fleet.tables.pool_bookings[0].status).toBe('returned');
  expect(fleet.tables.pool_bookings[0]).toMatchObject({
    return_odometer_km: 45210,
    return_check_ok: true,
  });

  // The manager marks another vehicle as a pool vehicle.
  await page.getByRole('button', { name: 'רכבי המאגר: 76-543-21' }).click();
  await expect.poll(() => fleet.tables.vehicles[1].pool).toBe(true);
});

// OPS-06: the week calendar shows each pool vehicle's bookings by day, and an approved booking
// leads to the morning check before the keys are handed over.
test('the pool week calendar opens a booking and its handover check', async ({ page }) => {
  const at = (hour) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager', full_name: 'דנה' },
        permissions: ['vehicles.read', 'pool.manage'],
      },
    },
    rpc: { fleet_features: ['pool'] },
    tables: {
      vehicles: [
        { id: 'v1', org_id: 'o1', plate_number: '12-345-67', pool: true, traccar_device_id: 1 },
      ],
      pool_bookings: [
        {
          id: 'b1',
          org_id: 'o1',
          vehicle_id: 'v1',
          requested_by: 'p1',
          status: 'approved',
          starts_at: at(8),
          ends_at: at(12),
          destination: 'חיפה',
        },
      ],
      profiles: [{ id: 'p1', org_id: 'o1', full_name: 'דנה' }],
    },
  });
  await gotoReady(page, '/fleet/pool');
  await page.getByRole('button', { name: 'לוח שבועי' }).click();
  await expect(page).toHaveURL(/view=calendar/);
  const calendar = page.getByRole('table', { name: 'לוח שבועי' });
  await expect(calendar.getByRole('rowheader', { name: '12-345-67' })).toBeVisible();
  // Today's column is marked, and the booking sits in it.
  await expect(calendar.locator('[aria-current="date"]')).toHaveCount(1);
  await calendar.getByRole('button', { name: /12-345-67: דנה, 08:00–12:00/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('חיפה');
  await dialog.getByRole('link', { name: 'בדיקה לפני מסירה' }).click();
  await expect(page).toHaveURL(/\/fleet\/inspection\?deviceId=1/);
});

// ISR-05: the month's nights with a pool car go to payroll, with the benefit to charge.
test('the pool nights of the month are exported for payroll', async ({ page }) => {
  const day = (offset, hour) => {
    const date = new Date();
    date.setDate(1 + offset);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager', full_name: 'דנה' },
        permissions: ['vehicles.read', 'pool.manage'],
      },
    },
    rpc: { fleet_features: ['pool'] },
    tables: {
      vehicles: [
        { id: 'v1', org_id: 'o1', plate_number: '12-345-67', pool: true, traccar_device_id: 1 },
      ],
      pool_bookings: [
        {
          id: 'b1',
          org_id: 'o1',
          vehicle_id: 'v1',
          requested_by: 'p1',
          status: 'returned',
          starts_at: day(0, 16),
          ends_at: day(2, 8),
        },
      ],
      profiles: [{ id: 'p1', org_id: 'o1', full_name: 'דנה' }],
    },
  });
  await gotoReady(page, '/fleet/pool');
  await page.getByRole('button', { name: 'ייצוא לשכר' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'חודש נוכחי' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/pool-payroll-\d{4}-\d{2}.*\.xlsx$/);
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await file.path());
  const values = [];
  workbook.worksheets[0].eachRow((row) => values.push(row.values.filter(Boolean).join('|')));
  // Two nights with the car, for Dana.
  expect(values.some((line) => line.includes('דנה') && line.includes('|2'))).toBe(true);
  expect(workbook.worksheets[1].rowCount).toBeGreaterThan(1);
});
