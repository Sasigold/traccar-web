import { Buffer } from 'node:buffer';
import { test, expect, gotoReady, axe, formatViolations } from './fixtures';
import { writeMode } from './fakeFleet';

// LIV-19: the geofences page is a destination: a title without a back arrow, one main action,
// and a file import that the keyboard reaches and that explains a file without a path.
test.describe('geofences page', () => {
  // Geofences are a destination for users who can edit.
  test.beforeEach(({ page }) => writeMode(page));

  test('a title, a main action that starts drawing, and Hebrew drawing tools', async ({ page }) => {
    await gotoReady(page, '/geofences');
    await expect(page.getByRole('heading', { level: 1, name: 'גדרות וירטואליות' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'חזרה' })).toHaveCount(0);
    await expect(page.locator('.mapbox-gl-draw_polygon')).toHaveAttribute('aria-label', /.+/);
    await page.getByRole('button', { name: 'גדר חדשה' }).click();
    await expect(page.locator('.mapbox-gl-draw_polygon')).toHaveClass(/active/);

    const results = await axe(page).exclude('.maplibregl-canvas').analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('imports a file and explains one without a path', async ({ page, isMobile }) => {
    const created = [];
    await page.route('**/api/geofences', async (route) => {
      if (route.request().method() === 'POST') {
        created.push(JSON.parse(route.request().postData()));
        await route.fulfill({ json: { id: 77, ...created.at(-1) } });
      } else {
        await route.fallback();
      }
    });
    await gotoReady(page, '/geofences');
    await expect(
      page.getByRole('button', { name: isMobile ? 'העלאה' : 'יבוא מקובץ' }),
    ).toBeVisible();
    const input = page.locator('input[type=file]');

    await input.setInputFiles({
      name: 'empty.gpx',
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from('<gpx><wpt lat="1" lon="2"/></gpx>'),
    });
    await expect(page.getByText('הקובץ לא מכיל מסלול או אזור')).toBeVisible();
    expect(created).toEqual([]);

    await input.setInputFiles({
      name: 'depot.geojson',
      mimeType: 'application/geo+json',
      buffer: Buffer.from(
        JSON.stringify({
          type: 'Feature',
          properties: { name: 'מחסן' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [34.8, 32.1],
                [34.9, 32.1],
                [34.9, 32.2],
                [34.8, 32.1],
              ],
            ],
          },
        }),
      ),
    });
    await expect(page).toHaveURL(/\/settings\/geofence\/77/);
    expect(created).toEqual([
      { name: 'מחסן', area: 'POLYGON ((32.1 34.8, 32.1 34.9, 32.2 34.9, 32.1 34.8))' },
    ]);
  });
});
