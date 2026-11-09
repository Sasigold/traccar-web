import { test, expect, gotoReady, FLEET } from './fixtures';

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

// A ticket for vehicle 1 driven by דנה לוי (Traccar driver 1), due in ten days.
const ticket = {
  id: 'v1',
  org_id: 'o1',
  driver_id: 'd1',
  vehicle_id: 'veh1',
  occurred_at: new Date(Date.now() - 80 * DAY).toISOString(),
  type: 'speeding',
  authority: 'משטרת ישראל',
  reference_no: '9001234567',
  location: null,
  fine_amount: 750,
  points: 4,
  status: 'assigned',
  received_at: isoDay(-80),
  due_at: isoDay(10),
  charge_driver: false,
  charged_at: null,
  notes: null,
  drivers: { full_name: 'דנה לוי', traccar_driver_id: 1 },
  vehicles: { plate_number: '12-345-67', traccar_device_id: 1 },
};

// The companion database answers with the ticket and records what the page writes.
const mockFleet = async (page, writes) => {
  // The demo server is read-only; the fleet login starts from a Traccar token.
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = request.url();
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    const answer = (row) => route.fulfill({ json: single ? row : [row] });
    if (url.includes('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o1', role: 'safety_officer' },
          permissions: ['safety.read', 'safety.write'],
        },
      });
    }
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), url, body: request.postDataJSON() });
      return route.fulfill({ status: 204 });
    }
    if (url.includes('/rest/v1/driver_violations')) return route.fulfill({ json: [ticket] });
    if (url.includes('/rest/v1/drivers?') && url.includes('national_id')) {
      return answer({ full_name: 'דנה לוי', national_id: '123456782', license_number: '7654321' });
    }
    if (url.includes('/rest/v1/vehicles?')) return answer({ plate_number: '12-345-67' });
    if (url.includes('/rest/v1/organizations?')) return answer({ name: 'הובלות הצפון בע"מ' });
    return route.fulfill({ json: [] });
  });
};

test('a ticket counts down to its transfer deadline and edits in place', async ({ page }) => {
  const writes = [];
  await mockFleet(page, writes);
  await gotoReady(page, '/fleet/safety');
  await page.getByRole('button', { name: 'עבירות ודוחות' }).click();

  const row = page.getByRole('row', { name: /9001234567|דנה לוי/ });
  await expect(row.getByText('עוד 10 ימים')).toBeVisible();

  await row.getByRole('button', { name: 'עריכת עבירה / דוח' }).click();
  const dialog = page.getByRole('dialog', { name: 'עריכת עבירה / דוח' });
  await expect(dialog.getByLabel('מספר דוח')).toHaveValue('9001234567');
  await expect(dialog.getByText(/החברה תחויב בקנס מוגדל/)).toBeVisible();
  await expect(dialog.getByText(/פי 4 מהקנס/)).toBeVisible();

  // The letter to the authority opens in its own window with the driver's details.
  const [letter] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'מכתב הסבה' }).click(),
  ]);
  await expect(letter.locator('body')).toContainText('123456782');
  await expect(letter.locator('body')).toContainText('12-345-67');
  await expect(letter.locator('body')).toContainText('הובלות הצפון בע"מ');
  await expect(letter.locator('html')).toHaveAttribute('dir', 'rtl');
  await letter.close();

  // Charging the driver is saved on the same ticket (an update, not a new one).
  await dialog.getByLabel('חיוב הנהג בקנס').check();
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  const update = writes.find((write) => write.url.includes('driver_violations'));
  expect(update.method).toBe('PATCH');
  expect(update.url).toContain('id=eq.v1');
  expect(update.body).toMatchObject({ charge_driver: true, driver_id: 'd1', vehicle_id: 'veh1' });

  // The by-driver view sums the tickets.
  await page.getByRole('button', { name: 'דוחות לפי נהג' }).click();
  await expect(page.getByRole('row', { name: /דנה לוי/ })).toContainText('₪');
});

test('a ticket near its deadline shows on the dashboard and opens the tickets', async ({
  page,
}) => {
  await mockFleet(page, []);
  await gotoReady(page, '/dashboard');
  const widget = page.getByRole('region', { name: 'צריך טיפול עכשיו' });
  const item = widget.getByRole('link', { name: /דנה לוי.*דוח להסבה לנהג, המועד בעוד 10 ימים/ });
  await expect(item).toContainText('חשוב');
  await item.click();
  await expect(page).toHaveURL(/\/fleet\/safety\?view=violations/);
  await expect(page.getByRole('row', { name: /9001234567|דנה לוי/ })).toBeVisible();
});
