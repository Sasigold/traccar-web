import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// BIZ-05: the SIM inventory: the carrier's list in, a card put in a device.
const platformAdmin = {
  profile: { id: 'p0', org_id: 'o0', role: 'owner' },
  permissions: ['customers.read', 'customers.manage'],
};

test('a carrier list is imported and a SIM put in a device', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same table on a phone');
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: platformAdmin },
    tables: { sim_cards: [], customers: [], customer_users: [], device_registry: [] },
  });
  await gotoReady(page, '/admin/sims');
  const csv =
    'ICCID,מספר טלפון,ספק\n8997201000000000001,0521234567,Partner\n123,0520000000,Partner\n';
  await page.locator('input[type=file]').setInputFiles({
    name: 'sims.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('יובאו 1 כרטיסים. 1 שורות דולגו')).toBeVisible();
  expect(fleet.tables.sim_cards).toEqual([
    expect.objectContaining({
      iccid: '8997201000000000001',
      msisdn: '0521234567',
      carrier: 'Partner',
    }),
  ]);
  await page.getByRole('combobox', { name: 'מכשיר' }).click();
  await page.getByRole('option', { name: 'Delivery Van' }).click();
  await expect.poll(() => fleet.tables.sim_cards[0].traccar_device_id).toBe(1);
});
