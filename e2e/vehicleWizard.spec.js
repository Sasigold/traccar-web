import { test, expect, gotoReady } from './fixtures';

// The demo is read-only: the wizard's writes to Traccar are answered here and recorded.
const mockTraccarWrites = async (page) => {
  const writes = [];
  const record = (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    writes.push({ method: request.method(), path: new URL(request.url()).pathname, body });
    return body;
  };
  await page.route('**/api/devices', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ json: { id: 77, attributes: {}, status: 'unknown', ...record(route) } })
      : route.fallback(),
  );
  await page.route('**/api/devices/77', (route) => route.fulfill({ json: record(route) }));
  await page.route('**/api/devices/77/accumulators', (route) => {
    record(route);
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/permissions', (route) => {
    record(route);
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/maintenance', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ json: { id: 501, ...record(route) } })
      : route.fallback(),
  );
  return writes;
};

test('a new vehicle goes from device to maintenance plan in one flow', async ({ page }) => {
  const writes = await mockTraccarWrites(page);
  await gotoReady(page, '/fleet/vehicle/new');

  await page.getByLabel('שם').fill('Truck 9');
  await page.getByLabel('מזהה').fill('356938035643809');
  await page.getByRole('button', { name: 'יצירת הרכב' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ממתינים לדיווח ראשון' })).toBeVisible();
  expect(writes[0]).toMatchObject({
    method: 'POST',
    body: { name: 'Truck 9', uniqueId: '356938035643809' },
  });
  await page.getByRole('button', { name: 'המשך' }).click();

  await page.getByLabel('מספר רישוי').fill('12-345-99');
  await page.getByRole('button', { name: 'המשך' }).click();
  const put = writes.find(
    (write) => write.method === 'PUT' && write.path.endsWith('/api/devices/77'),
  );
  expect(put.body.attributes).toMatchObject({ plateNumber: '12-345-99' });

  await page.getByRole('button', { name: 'המשך' }).click(); // validity: nothing to add

  await page.getByLabel('נהג קבוע').click();
  await page.getByRole('option', { name: 'דנה לוי' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  expect(writes.find((write) => write.body?.driverId)).toMatchObject({
    body: { deviceId: 77, driverId: 1 },
  });

  await page.getByLabel('מד אוץ היום (ק"מ)').fill('82500');
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(page.getByRole('link', { name: 'לכרטיס הרכב' })).toHaveAttribute(
    'href',
    '/fleet/vehicle/77',
  );
  expect(writes.find((write) => write.path.endsWith('/accumulators')).body).toMatchObject({
    totalDistance: 82_500_000,
  });
  expect(writes.find((write) => write.path.endsWith('/api/maintenance')).body).toMatchObject({
    name: 'טיפול שוטף כל 15,000 ק"מ · Truck 9',
    type: 'totalDistance',
    start: 82_500_000,
    period: 15_000_000,
  });
  expect(writes.find((write) => write.body?.maintenanceId)).toMatchObject({
    body: { deviceId: 77, maintenanceId: 501 },
  });
});
