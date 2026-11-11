import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-27: a recipient's number as people type it, chosen from the users, and a test message.
test('a recipient is added with a local number and tested', async ({ page }) => {
  await writeMode(page);
  const tests = [];
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['alerts.read', 'alerts.manage'],
      },
    },
    rpc: {
      fleet_features: ['alerts'],
      messaging_ready: [
        { channel: 'whatsapp', ready: true },
        { channel: 'email', ready: false },
      ],
      alert_recipient_test: (body) => {
        tests.push(body);
        return 'd1';
      },
    },
    tables: {
      alert_recipients: [],
      profiles: [{ id: 'p2', org_id: 'o1', full_name: 'יוסי כהן', email: 'yossi@example.co.il' }],
      document_alerts: [],
      notification_deliveries: [],
    },
  });
  await gotoReady(page, '/fleet/alerts');
  await page
    .getByRole('button', { name: /נמענים|מי מקבל/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /הוספת נמען|נמען חדש/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('בחירה מתוך המשתמשים').click();
  await page.getByRole('option', { name: 'יוסי כהן' }).click();
  const phone = dialog.getByLabel(/טלפון|מספר/).last();
  await phone.fill('050');
  await expect(dialog.getByText('מספר טלפון לא תקין')).toBeVisible();
  await phone.fill('050-1234567');
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect.poll(() => fleet.tables.alert_recipients.length).toBe(1);
  expect(fleet.tables.alert_recipients[0]).toMatchObject({
    name: 'יוסי כהן',
    address: '+972501234567',
  });

  fleet.tables.alert_recipients[0].id = 'r1';
  await page.reload();
  await page
    .getByRole('button', { name: /נמענים|מי מקבל/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'שליחת הודעת בדיקה: יוסי כהן' }).click();
  await expect(page.getByText('הודעת בדיקה נשלחה אל יוסי כהן')).toBeVisible();
  expect(tests).toEqual([{ p_recipient: 'r1' }]);
});
