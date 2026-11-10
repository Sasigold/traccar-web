import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// SEC-22: an API key is made on the server, with an expiry; the browser never sends a hash.
test('a new key comes from the server, once, with the chosen validity', async ({ page }) => {
  await writeMode(page);
  const calls = [];
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['integrations.manage'],
      },
    },
    rpc: {
      fleet_features: ['integrations'],
      create_api_key: (body) => {
        calls.push(body);
        return { id: 'k1', key: `vf_${'a'.repeat(40)}`, expires_at: body.p_expires_at };
      },
    },
    tables: { api_keys: [], webhooks: [], webhook_deliveries: [] },
  });
  await gotoReady(page, '/fleet/integrations');
  await page.getByRole('button', { name: 'מפתח חדש' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('שם').fill('ERP');
  await dialog.getByLabel('תוקף המפתח').click();
  await page.getByRole('option', { name: '6 חודשים' }).click();
  await dialog.getByRole('button', { name: 'יצירה' }).click();
  await expect(dialog.getByText(`vf_${'a'.repeat(40)}`)).toBeVisible();

  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ p_name: 'ERP', p_scopes: ['read'] });
  const months = (Date.parse(calls[0].p_expires_at) - Date.now()) / (30.4 * 86400000);
  expect(months).toBeGreaterThan(5.5);
  expect(months).toBeLessThan(6.5);
  expect(fleet.tables.api_keys).toEqual([]);
});
