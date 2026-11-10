import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// OPS-02: fuel checks, each a switch with a one-line explanation, and where the vehicle was.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['costs.read', 'costs.write'],
};

test('a fill-up while the vehicle drove and one over the tank are found; checks switch off', async ({
  page,
}) => {
  await writeMode(page);
  const now = Date.now();
  const fleet = await fakeFleet(page, {
    users: { 1: manager },
    tables: {
      vehicles: [{ id: 'v1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' }],
      org_fuel_settings: [],
      fuel_transactions: [
        {
          id: 'f1',
          org_id: 'o1',
          vehicle_id: 'v1',
          occurred_at: new Date(now - 10 * 60000).toISOString(),
          liters: 40,
          total: 300,
          anomaly_flags: [],
        },
        {
          id: 'f2',
          org_id: 'o1',
          vehicle_id: 'v1',
          occurred_at: new Date(now - 3 * 86400000).toISOString(),
          liters: 140,
          total: 1050,
          anomaly_flags: ['over_capacity'],
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/fuel-checks');
  await expect(page.getByRole('cell', { name: 'יותר מנפח המכל' })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'התדלוק לא היה במקום של הרכב' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: /הרכב היה בנסיעה/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'איפה הרכב היה' }).first()).toHaveAttribute(
    'href',
    /\/replay\?deviceId=1&from=/,
  );

  await page.getByRole('button', { name: 'הבדיקות' }).click();
  await page.getByRole('switch', { name: /יותר מנפח המכל/ }).click();
  await page.getByRole('button', { name: 'בדיקה מחדש' }).click();
  await expect(page.getByRole('cell', { name: 'יותר מנפח המכל' })).toHaveCount(0);
  await expect
    .poll(() => fleet.tables.org_fuel_settings[0]?.rules)
    .toEqual({ overCapacity: false });
});
