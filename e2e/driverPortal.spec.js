import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-22: the driver portal in the sun: today's morning check, jobs that refresh, an undo, and
// someone to call.
const driver = {
  profile: { id: 'p1', org_id: 'o1', role: 'driver' },
  permissions: ['inspections.write', 'incidents.write', 'dispatch.read', 'dispatch.driver'],
};
const contact = { name: 'דנה כהן', phone: '0501234567' };

const setup = (page, tables, rpc = { org_contact: contact }) =>
  fakeFleet(page, {
    users: { 1: driver },
    rpc,
    tables: {
      drivers: [{ id: 'd1', org_id: 'o1', full_name: 'Yossi', profile_id: 'p1' }],
      current_assignments: [
        { driver_id: 'd1', vehicle_id: 'v1', traccar_device_id: 1, plate_number: '12-345-67' },
      ],
      documents_expiring: [],
      incidents: [],
      inspections: [],
      dispatch_jobs: [],
      vehicle_out_of_service: [],
      ...tables,
    },
  });

test('the morning check is the main action until it is done today', async ({ page }) => {
  await writeMode(page);
  await setup(page, {});
  await gotoReady(page, '/driver');
  await expect(page.getByText('בדיקת בוקר: טרם בוצעה')).toBeVisible();
  await expect(page.getByRole('link', { name: 'בדיקת בוקר' })).toHaveClass(/MuiButton-contained/);
  await expect(page.getByRole('link', { name: 'צרו קשר עם הסדרן' })).toHaveAttribute(
    'href',
    'tel:0501234567',
  );
});

test('a check done today shows its time', async ({ page }) => {
  await writeMode(page);
  await setup(page, {
    inspections: [
      {
        id: 'i1',
        org_id: 'o1',
        driver_id: 'd1',
        started_at: new Date().toISOString(),
        result: 'pass',
        template_name: 'יומית',
      },
    ],
  });
  await gotoReady(page, '/driver');
  await expect(page.getByText(/^בדיקת בוקר: בוצעה \d{2}:\d{2} ✓$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'בדיקת בוקר' })).toHaveClass(/MuiButton-outlined/);
});

test('a job moved by mistake can be taken back', async ({ page }) => {
  await writeMode(page);
  const fleet = await setup(page, {
    dispatch_jobs: [
      {
        id: 'j1',
        org_id: 'o1',
        driver_id: 'd1',
        title: 'משלוח לחיפה',
        status: 'assigned',
        scheduled_at: new Date().toISOString(),
      },
    ],
  });
  await gotoReady(page, '/driver');
  await page.getByRole('button', { name: 'יציאה לדרך' }).click();
  await expect.poll(() => fleet.tables.dispatch_jobs[0].status).toBe('en_route');
  await page.getByRole('button', { name: 'ביטול' }).click();
  await expect.poll(() => fleet.tables.dispatch_jobs[0].status).toBe('assigned');
});

test('a driver who is not linked can call the dispatcher', async ({ page }) => {
  await writeMode(page);
  await setup(page, { drivers: [] });
  await gotoReady(page, '/driver');
  await expect(page.getByText('אפשר לפנות אל דנה כהן:')).toBeVisible();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
    'href',
    'https://wa.me/972501234567',
  );
});

// A11-10: the driver's screens in Arabic, right to left.
test('the driver portal reads in Arabic', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('language', JSON.stringify('ar')));
  await writeMode(page);
  await setup(page, {});
  await gotoReady(page, '/driver');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('الفحص الصباحي: لم يُنجز بعد')).toBeVisible();
  await expect(page.getByRole('link', { name: 'التواصل مع المُرسِل' })).toBeVisible();
  await page.screenshot({ path: `test-results/driver-ar-${test.info().project.name}.png` });
});
