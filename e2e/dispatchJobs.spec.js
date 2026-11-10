import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-20: on the way is normal, late is a warning; a job is duplicated or cancelled from its
// row; a failed job says why.
const dispatcher = {
  profile: { id: 'p1', org_id: 'o1', role: 'dispatcher' },
  permissions: ['dispatch.read', 'dispatch.write', 'vehicles.read', 'drivers.read', 'poi.read'],
};
const hour = 3600000;
const job = (id, title, status, windowEnd, extra = {}) => ({
  id,
  org_id: 'o1',
  number: id.length,
  title,
  type: 'delivery',
  priority: 'normal',
  status,
  scheduled_at: new Date(Date.now() - 2 * hour).toISOString(),
  window_end: new Date(Date.now() + windowEnd * hour).toISOString(),
  ...extra,
});

test('late jobs stand out, and a row is duplicated or cancelled', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the row menu is the same on a phone card');
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: dispatcher },
    rpc: { fleet_features: ['dispatch'] },
    tables: {
      dispatch_jobs: [
        job('j1', 'משלוח לחיפה', 'en_route', -1),
        job('j22', 'משלוח לנתניה', 'en_route', 2, { customer_name: 'שלמה' }),
      ],
      pois: [],
      vehicles: [],
      drivers: [],
    },
  });
  await gotoReady(page, '/fleet/dispatch');
  const late = page.getByRole('row', { name: /משלוח לחיפה/ });
  const onTime = page.getByRole('row', { name: /משלוח לנתניה/ });
  await expect(late).toContainText('באיחור');
  await expect(onTime).not.toContainText('באיחור');

  await onTime.getByRole('button', { name: 'פעולות' }).click();
  await page.getByRole('menuitem', { name: 'שכפול' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: 'משימה' })).toHaveValue('משלוח לנתניה');
  await dialog.getByRole('button', { name: 'ביטול' }).click();

  await late.getByRole('button', { name: 'פעולות' }).click();
  await page.getByRole('menuitem', { name: 'ביטול המשימה' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול המשימה' }).click();
  await expect
    .poll(() => fleet.tables.dispatch_jobs.find((row) => row.id === 'j1').status)
    .toBe('cancelled');
});

// OPS-03: a vehicle's stops in a good order, saved for the driver's list.
test('a route is planned for a vehicle and its order saved', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same dialog on a phone');
  await writeMode(page);
  const at = (east) => ({ latitude: 51.5, longitude: 0.1 + east * 0.02 });
  const stop = (id, east) => ({
    ...job(id, `עצירה ${id}`, 'assigned', 5),
    vehicle_id: 'v1',
    ...at(east),
  });
  const fleet = await fakeFleet(page, {
    users: { 1: dispatcher },
    rpc: { fleet_features: ['dispatch'] },
    tables: {
      dispatch_jobs: [stop('c', 3), stop('a', 1), stop('b', 2)],
      pois: [],
      vehicles: [{ id: 'v1', org_id: 'o1', plate_number: '12-345-67', traccar_device_id: 1 }],
      drivers: [],
    },
  });
  await gotoReady(page, '/fleet/dispatch');
  await page.getByRole('button', { name: 'תכנון מסלול' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('listitem')).toHaveText([
    /1\. עצירה a/,
    /2\. עצירה b/,
    /3\. עצירה c/,
  ]);
  await dialog.getByRole('button', { name: 'החלת הסדר' }).click();
  await expect
    .poll(() =>
      Object.fromEntries(fleet.tables.dispatch_jobs.map((row) => [row.id, row.route_order])),
    )
    .toEqual({ a: 1, b: 2, c: 3 });
});

// ISR-10: an address from the official street list, with its coordinates filled in.
test('a Hebrew address is completed and located', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same field on a phone');
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: dispatcher },
    rpc: { fleet_features: ['dispatch'] },
    tables: { dispatch_jobs: [], pois: [], vehicles: [], drivers: [] },
  });
  await page.route('https://data.gov.il/**', (route) =>
    route.fulfill({
      json: { result: { records: [{ שם_רחוב: 'הרצל', שם_ישוב: 'רמת גן' }] } },
    }),
  );
  const geocoded = [];
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    geocoded.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({ json: [{ lat: '32.0823', lon: '34.8106' }] });
  });
  await gotoReady(page, '/fleet/dispatch');
  await page.getByRole('button', { name: 'משימה חדשה' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'כתובת' }).fill('הרצל 12');
  await page.getByRole('option', { name: 'הרצל 12, רמת גן' }).click();
  await expect(dialog.getByLabel('קו רוחב')).toHaveValue('32.0823');
  await expect(dialog.getByLabel('קו אורך')).toHaveValue('34.8106');
  expect(geocoded).toEqual(['הרצל 12, רמת גן']);
});
