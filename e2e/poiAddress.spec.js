import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ISR-10: a point of interest is found by its Hebrew address, and the address sets its place.
test('a point of interest is located from its Hebrew address', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['poi.read', 'poi.write'],
      },
    },
    tables: { pois: [] },
  });
  await page.route('https://data.gov.il/**', (route) =>
    route.fulfill({
      json: { result: { records: [{ שם_רחוב: 'הרצל', שם_ישוב: 'רמת גן' }] } },
    }),
  );
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ json: [{ lat: '32.0823', lon: '34.8106' }] }),
  );
  await gotoReady(page, '/fleet/poi');
  await page.getByRole('button', { name: 'הוספת נקודה' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'כתובת' }).fill('הרצל 12');
  await page.getByRole('option', { name: 'הרצל 12, רמת גן' }).click();
  await expect(dialog.getByLabel('קו רוחב')).toHaveValue('32.0823');
  await expect(dialog.getByLabel('קו אורך')).toHaveValue('34.8106');
});
