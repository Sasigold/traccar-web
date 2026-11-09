import { test, expect, gotoReady } from './fixtures';

// data.gov.il is replaced by a fixed answer so the test does not depend on it.
const record = {
  mispar_rechev: 75128203,
  tozeret_nm: "מ.ג'י סין",
  kinuy_mishari: 'ZS',
  shnat_yitzur: 2025,
  misgeret: 'LSJWS4393RZ309720',
  sug_delek_nm: 'בנזין',
  baalut: 'פרטי',
  tokef_dt: '2027-01-06',
};

test('the vehicle card fills from the government registry after showing the changes', async ({
  page,
}) => {
  await page.route('https://data.gov.il/api/3/action/package_show**', (route) =>
    route.fulfill({
      json: { success: true, result: { resources: [{ id: 'r1', datastore_active: true }] } },
    }),
  );
  await page.route('https://data.gov.il/api/3/action/datastore_search**', (route) => {
    const filters = JSON.parse(new URL(route.request().url()).searchParams.get('filters'));
    route.fulfill({
      json: {
        success: true,
        result: { records: filters.mispar_rechev === 75128203 ? [record] : [] },
      },
    });
  });

  await gotoReady(page, '/settings/device/1');
  await page.getByLabel('מספר רישוי').fill('751-28-203');
  await page.getByRole('button', { name: 'מילוי מהמאגר הממשלתי' }).click();
  const dialog = page.getByRole('dialog', { name: 'פרטי הרכב במאגר משרד התחבורה' });
  await expect(dialog.getByRole('cell', { name: 'LSJWS4393RZ309720' })).toBeVisible();
  await dialog.getByRole('button', { name: 'עדכון הכרטיס' }).click();
  await expect(page.getByLabel('יצרן')).toHaveValue("מ.ג'י סין");
  await expect(page.getByLabel('שנת ייצור')).toHaveValue('2025');

  // A plate that is not in the registry says so.
  await page.getByLabel('מספר רישוי').fill('11-111-11');
  await page.getByRole('button', { name: 'מילוי מהמאגר הממשלתי' }).click();
  await expect(page.getByText('מספר הרישוי לא נמצא במאגר.')).toBeVisible();
});
