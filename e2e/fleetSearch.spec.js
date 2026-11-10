import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-31: Ctrl+K finds a work order by its number and opens it.
test('a work order is found from Ctrl+K by its number', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Ctrl+K is a keyboard shortcut');
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['maintenance.read', 'vehicles.read'],
      },
    },
    tables: {
      vehicles: [{ id: 'veh1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' }],
      work_orders: [
        {
          id: 'w1',
          org_id: 'o1',
          number: 1042,
          title: 'טיפול 30,000',
          status: 'open',
          vehicle_id: 'veh1',
          opened_at: new Date().toISOString(),
        },
      ],
      work_order_items: [],
    },
  });
  await gotoReady(page, '/');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('1042');
  const option = page.getByRole('option', { name: /הזמנת עבודה 1042 · טיפול 30,000/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(/\/fleet\/work-order\/w1$/);
});
