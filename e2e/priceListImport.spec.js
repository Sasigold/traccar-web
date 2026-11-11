import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ISR-13: a supplier's price list from a CSV file: a known item updates, new ones are added.
test('a price list is imported from a file', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['maintenance.read', 'maintenance.write'],
      },
    },
    tables: {
      vendors: [{ id: 'g1', org_id: 'o1', name: 'מוסך הצפון', type: 'garage', active: true }],
      vendor_prices: [
        {
          id: 'vp1',
          org_id: 'o1',
          vendor_id: 'g1',
          description: 'החלפת שמן',
          kind: 'labor',
          unit_price: 200,
          tolerance_pct: 5,
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/vendors');
  await page.getByRole('button', { name: 'מחירון מוסכם: מוסך הצפון' }).click();
  const dialog = page.getByRole('dialog');

  const csv = 'תיאור,סוג,מחיר מוסכם\nהחלפת שמן,עבודה,180\nפילטר שמן,חלק,45\nרפידות,חלק,לא ידוע\n';
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'בחירת קובץ מחירון' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'prices.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(dialog.getByRole('status')).toHaveText('1 חדשים, 1 עדכוני מחיר, 1 שורות עם בעיה');
  await expect(dialog.getByText('שורה 4: מחיר לא תקין')).toBeVisible();
  await dialog.getByRole('button', { name: 'ייבוא 2 שורות' }).click();
  await expect(dialog.getByText('המחירון יובא: 1 חדשים, 1 עודכנו')).toBeVisible();

  const rows = fleet.tables.vendor_prices;
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.id === 'vp1').unit_price).toBe(180);
  expect(rows.find((row) => row.description === 'פילטר שמן')).toMatchObject({
    vendor_id: 'g1',
    kind: 'part',
    unit_price: 45,
  });
});
