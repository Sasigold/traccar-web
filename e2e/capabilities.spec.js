import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-08: screens say what works today and hide what this database does not have.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['alerts.read', 'alerts.manage', 'maintenance.read', 'dispatch.read', 'poi.read'],
};

test('areas the database does not have are not offered', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the section menu is on desktop');
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['workOrders', 'alerts'] },
  });
  await gotoReady(page, '/fleet/work-orders');
  const menu = page.locator('.app-section-nav');
  await expect(menu.getByRole('link', { name: 'הזמנות עבודה' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'שיגור' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'נקודות עניין' })).toHaveCount(0);
});

test('the outbox says sending is not connected, and only working alert kinds are offered', async ({
  page,
}) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { messaging_ready: [{ channel: 'whatsapp', ready: false }] },
  });
  await gotoReady(page, '/fleet/alerts');
  await page.getByRole('button', { name: 'הודעות יוצאות' }).click();
  await expect(page.getByText(/השליחה עוד לא מחוברת/)).toBeVisible();

  await page.getByRole('button', { name: 'נמענים' }).click();
  await page.getByRole('button', { name: 'הוספת נמען' }).first().click();
  await page.getByLabel('מקבל').click();
  await expect(page.getByRole('option', { name: 'תחזוקה (בקרוב)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});
