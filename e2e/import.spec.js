import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { writeMode } from './fakeFleet';

// ADM-13: vehicles from a spreadsheet, and actions on many vehicles at once.
const csv = [
  'שם הרכב,מספר רישוי,IMEI,קבוצה,תוקף טסט',
  'טנדר יבוא,1234561,490154203237518,צפון,1/3/2027',
  'משאית יבוא,7654321,860777,מרכז,',
  'שגוי,12,860778,,',
  'כפול,,demo-1,,',
].join('\n');

test('vehicles come in from a spreadsheet, each row checked', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/devices');
  await page.getByRole('button', { name: 'ייבוא מאקסל' }).click();
  const dialog = page.getByRole('dialog', { name: 'ייבוא רכבים מאקסל' });
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'vehicles.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(dialog.getByRole('status')).toHaveText(
    '2 שורות מוכנות לייבוא · 1 עם שגיאות · 1 כבר קיימות',
  );
  await expect(dialog.getByText('מספר רישוי: מספר רישוי לא תקין', { exact: false })).toBeVisible();
  await expect(dialog.getByText('כבר קיים במערכת')).toBeVisible();

  const created = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/devices')) {
      created.push(request.postDataJSON());
    }
  });
  await dialog.getByRole('button', { name: 'ייבוא 2' }).click();
  await expect(dialog.getByRole('status')).toContainText('נוספו 2');
  expect(created).toHaveLength(2);
  expect(created[0]).toMatchObject({
    name: 'טנדר יבוא',
    uniqueId: '490154203237518',
    groupId: 1,
    attributes: { plateNumber: '12-345-61', testExpiry: '2027-03-01' },
  });
});

test('many vehicles move to a group at once', async ({ page }) => {
  await writeMode(page);
  await gotoReady(page, '/settings/devices');
  await page.getByRole('checkbox', { name: 'בחירת Delivery Van' }).check();
  await page.getByRole('checkbox', { name: 'בחירת Courier' }).check();
  const bar = page.getByRole('region', { name: 'פעולות על הרכבים שנבחרו' });
  await expect(bar.getByRole('status')).toHaveText('נבחרו 2');
  await bar.getByRole('button', { name: 'העברה לקבוצה' }).click();
  const dialog = page.getByRole('dialog', { name: 'העברה לקבוצה' });
  await dialog.getByRole('combobox', { name: 'קבוצה' }).click();
  await page.getByRole('option', { name: 'מרכז' }).click();
  const updates = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && /\/api\/devices\/\d+$/.test(request.url())) {
      updates.push(request.postDataJSON());
    }
  });
  await dialog.getByRole('button', { name: 'עדכון 2' }).click();
  await expect(dialog).toBeHidden();
  expect(updates.map((device) => [device.name, device.groupId]).sort()).toEqual([
    ['Courier', 2],
    ['Delivery Van', 2],
  ]);
  await expect(bar).toBeHidden();
});
