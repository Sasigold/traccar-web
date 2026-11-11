import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// INT-04: a template fills the webhook form; only the Make or Zapier URL is pasted.
test('a Make/Zapier template prefills the webhook and saves it', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['integrations.manage'],
      },
    },
    rpc: { fleet_features: ['integrations'] },
    tables: { api_keys: [], webhooks: [], webhook_deliveries: [] },
  });
  await gotoReady(page, '/fleet/integrations');
  await page.getByRole('button', { name: 'Webhooks' }).click();
  const templates = page.getByRole('region', { name: 'תבניות מוכנות ל-Make ול-Zapier' });
  const card = templates.locator('.MuiCard-root').filter({ hasText: 'משלוח נמסר' });
  await expect(card).toContainText('data.status = done');

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await card.getByRole('button', { name: 'העתקת דוגמה' }).click();
  await expect(page.getByText('הדוגמה הועתקה')).toBeVisible();
  const sample = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(sample).toMatchObject({ event: 'dispatch_jobs.status', data: { status: 'done' } });

  await card.getByRole('button', { name: 'שימוש בתבנית' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('שם')).toHaveValue('משלוח נמסר: הודעה ללקוח');
  await dialog.getByLabel(/כתובת/).fill('https://hook.eu1.make.com/abc123');
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(fleet.tables.webhooks).toHaveLength(1);
  expect(fleet.tables.webhooks[0]).toMatchObject({
    url: 'https://hook.eu1.make.com/abc123',
    events: ['dispatch_jobs.status'],
  });
});
