import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// LIV-21: right click on the live map: who is closest, and a job for one of them in one click.
const dispatcher = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['dispatch.read', 'dispatch.write', 'vehicles.read'],
};

test('nearby vehicles from the map, and a job for the closest', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: dispatcher },
    rpc: { fleet_features: ['dispatch'] },
    tables: {
      vehicles: [{ id: 'v1', org_id: 'o1', plate_number: '12-345-67', traccar_device_id: 1 }],
      dispatch_jobs: [],
      pois: [],
      drivers: [],
    },
  });
  await gotoReady(page, '/');
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();

  const canvas = page.locator('.maplibregl-canvas');
  await canvas.click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'יצירת גדר כאן' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /ניווט לכאן/ })).toHaveAttribute(
    'href',
    /^https:\/\/waze\.com\/ul\?ll=/,
  );
  await menu.getByRole('menuitem', { name: 'רכבים קרובים' }).click();

  const dialog = page.getByRole('dialog', { name: 'רכבים קרובים' });
  const rows = dialog.getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  // Sorted by distance: each row's kilometers are not less than the one before.
  const distances = (await rows.allInnerTexts()).map((text) =>
    Number(/([\d.]+) ק"מ/.exec(text)[1]),
  );
  expect(distances).toEqual([...distances].sort((a, b) => a - b));

  const deliveryVan = rows.filter({ hasText: 'Delivery Van' });
  await deliveryVan.getByRole('button', { name: 'שליחת משימה' }).click();
  await expect(page).toHaveURL(/\/fleet\/dispatch$/);
  const job = page.getByRole('dialog');
  await expect(job.getByLabel('קו רוחב')).not.toHaveValue('');
});

test('copying the coordinates of a point', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await gotoReady(page, '/');
  await page.locator('.maplibregl-canvas').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'העתקת קואורדינטות' }).click();
  await expect(page.getByText('הקואורדינטות הועתקו')).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^-?\d+\.\d{6}, -?\d+\.\d{6}$/);
});

// LIV-21: "measure from here" starts the ruler; a search result asks who is closest to it.
test('the map menu measures from a point, and a found address shows nearby vehicles', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'right click and the address search are desktop controls here');
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({
      json: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            bbox: [-0.13, 51.5, -0.11, 51.51],
            geometry: { type: 'Point', coordinates: [-0.12, 51.505] },
            properties: { place_id: 1, display_name: 'Waterloo, London' },
          },
        ],
      },
    }),
  );
  await gotoReady(page, '/');
  await page.locator('.maplibregl-canvas').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'מדידה מכאן' }).click();
  await expect(page.getByRole('button', { name: 'מרחק' })).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.maplibregl-ctrl').getByRole('button', { name: 'חיפוש' }).click();
  await page.getByRole('presentation').getByPlaceholder('חיפוש').fill('Waterloo');
  await page.getByRole('button', { name: 'רכבים קרובים: Waterloo, London' }).click();
  const dialog = page.getByRole('dialog', { name: 'רכבים קרובים' });
  await expect(dialog).toContainText('Waterloo, London');
});
