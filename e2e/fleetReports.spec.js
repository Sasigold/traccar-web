import { test, expect, axe, formatViolations, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

const ids = [1, 2, 3, 4, 5, 6].map((id) => `deviceId=${id}`).join('&');

for (const [name, path] of [
  ['usage', 'usage'],
  ['cost per km', 'cost-per-km'],
  ['device health', 'device-health'],
  ['emissions', 'emissions'],
]) {
  test(`the ${name} report lists every chosen vehicle`, async ({ page }) => {
    await gotoReady(page, `/reports/${path}?${ids}&period=today`);
    await page.getByRole('button', { name: 'הצג', exact: true }).click();
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Delivery Van' })).toHaveAttribute(
      'href',
      '/fleet/vehicle/1',
    );
    await expect(main.getByRole('link', { name: 'Service Van' })).toBeVisible();
    const { violations } = await axe(page).analyze();
    expect(formatViolations(violations)).toBe('');
  });
}

test('the usage report prices idle fuel once a price is set', async ({ page }) => {
  await gotoReady(page, `/reports/usage?deviceId=1&period=today`);
  await page.getByLabel(/מחיר דלק/).fill('7.4');
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  await expect(page.getByRole('main').getByRole('link', { name: 'Delivery Van' })).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByText(/₪\s?\d/)
      .first(),
  ).toBeVisible();
});

// OPS-04: vehicles that barely moved, and what returning one would save.
test('the usage report suggests a smaller fleet', async ({ page }) => {
  await page.route('**/api/reports/trips?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/reports/stops?*', (route) => route.fulfill({ json: [] }));
  const from = new Date();
  from.setDate(from.getDate() - 14);
  await gotoReady(
    page,
    `/reports/usage?deviceId=1&deviceId=2&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`,
  );
  await page.getByLabel(/עלות חודשית לרכב/).fill('3200');
  const note = page.getByRole('alert').filter({ hasText: 'בפחות מ-20% מהימים' });
  await expect(note).toContainText('2 רכבים');
  await expect(note).toContainText(/3,200/);
});

// BRD-04: figures line up: tabular digits, and number columns aligned to the end of the row.
for (const report of ['usage', 'trips', 'stops', 'summary']) {
  test(`number columns line up at the end: ${report}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'a phone shows the rows as cards');
    await gotoReady(page, `/reports/${report}?${ids}&period=today`);
    await page.getByRole('button', { name: 'הצג', exact: true }).click();
    // Trips and stops have several rows per vehicle; the first is enough.
    const row = page
      .getByRole('main')
      .getByRole('row', { name: /Delivery Van/ })
      .first();
    await expect(row).toBeVisible();
    // The row can show before its cells; wait for them.
    await expect(row.locator('td').first()).toBeVisible();
    const cells = await row.locator('td').evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: node.textContent,
        align: getComputedStyle(node).textAlign,
        numeric: getComputedStyle(node).fontVariantNumeric,
      })),
    );
    expect(cells[0].align).not.toBe('left');
    const figures = cells.slice(1).filter((cell) => /^[\d.,\s:%₪-]+$/.test(cell.text.trim()));
    expect(figures.length).toBeGreaterThan(0);
    figures.forEach((cell) => {
      expect(cell.align).toBe('left');
      expect(cell.numeric).toContain('tabular-nums');
    });
  });
}

// OPS-10: without fuel data the CO2 is estimated from kilometers, and says so.
test('the emissions report estimates CO2 from kilometers', async ({ page }) => {
  await page.route('**/api/reports/summary?*', (route) =>
    route.fulfill({ json: [{ deviceId: 1, distance: 100000 }] }),
  );
  await gotoReady(page, `/reports/emissions?deviceId=1&period=today`);
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  const row = page.getByRole('main').getByRole('row', { name: /Delivery Van/ });
  await expect(row).toContainText('164');
  await expect(row).toContainText('ק"מ (סוג דלק לא ידוע, לפי בנזין)');
});

// REP-13: a stop at one of the fleet's points of interest is named after it.
test('a stop at a point of interest shows its name', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'admin' }, permissions: ['poi.read'] },
    },
    tables: {
      pois: [
        {
          id: 'poi1',
          org_id: 'o1',
          name: 'מחסן צפון',
          latitude: 51.5,
          longitude: -0.12,
          radius_m: 150,
        },
      ],
    },
  });
  const now = Date.now();
  await page.route('**/api/reports/stops?*', (route) =>
    route.fulfill({
      json: [
        {
          deviceId: 1,
          positionId: 501,
          latitude: 51.5004,
          longitude: -0.1201,
          startTime: new Date(now - 3600000).toISOString(),
          endTime: new Date(now - 1800000).toISOString(),
          duration: 1800000,
          engineHours: 0,
        },
      ],
    }),
  );
  await gotoReady(page, '/reports/stops?deviceId=1&period=today');
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  await expect(page.getByRole('main').getByText('מחסן צפון')).toBeVisible();
});

// OPS-04: engine hours a day, and each vehicle against the middle vehicle of its group.
test('the usage report gives engine hours a day and compares within the group', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the columns are checked on the table');
  await gotoReady(page, `/reports/usage?${ids}&period=today`);
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  const main = page.getByRole('main');
  await expect(main.getByRole('columnheader', { name: 'שעות מנוע ליום' })).toBeVisible();
  await expect(main.getByRole('columnheader', { name: 'מול הקבוצה' })).toBeVisible();
  await expect(main.getByRole('cell', { name: /^\d+%$/ }).first()).toBeVisible();
});
