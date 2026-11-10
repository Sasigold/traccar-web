import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';

// ISR-06: a toll statement is matched to the trips and the drivers.
test('a toll statement is matched to trips and drivers', async ({ page }) => {
  const at = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const ddmm = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  await page.route('**/api/reports/trips?*', (route) =>
    route.fulfill({
      json: [
        {
          deviceId: 1,
          driverUniqueId: 'drv1',
          startTime: at(8, 0).toISOString(),
          endTime: at(9, 0).toISOString(),
        },
      ],
    }),
  );
  await gotoReady(page, '/reports/tolls');
  const csv = [
    'תאריך ושעה,מספר רכב,קטע,סכום לתשלום',
    `${ddmm(at(8, 30))},12-345-67,כביש 6,18.90`,
    `${ddmm(at(8, 30))},99-999-99,חניון,7`,
  ].join('\n');
  await page.locator('input[type=file]').setInputFiles({
    name: 'road6.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('הותאם לנסיעה')).toBeVisible();
  await expect(page.getByText('רכב לא מוכר')).toBeVisible();
  await expect(page.getByRole('status', { name: 'סכום לפי נהג' })).toContainText('18.90');
});
