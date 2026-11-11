import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// SAF-01: every safety event waits in the inbox until someone decides.
const officer = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['safety.read', 'safety.write'],
};

test('events wait in the inbox; a dismissed one leaves it, coaching names a person', async ({
  page,
}) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: { 1: officer },
    tables: {
      safety_event_reviews: [],
      drivers: [],
      profiles: [{ id: 'p1', full_name: 'רונית הממונה', is_active: true }],
    },
  });
  await gotoReady(page, '/fleet/safety/inbox');
  const pending = page.getByRole('status').filter({ hasText: 'ממתינים לבדיקה' });
  await expect(pending).toBeVisible();
  const before = Number(await pending.locator('div').nth(0).textContent());
  expect(before).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'דחייה' }).first().click();
  await expect(pending).toContainText(String(before - 1));
  const saved = fleet.tables.safety_event_reviews;
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ status: 'dismissed', org_id: 'o1', reviewed_by: 'p1' });

  await page.getByRole('button', { name: 'לאימון', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'לאימון' });
  // Nobody is known to have driven, so it cannot go to the driver.
  await expect(dialog.getByRole('checkbox')).toBeDisabled();
  await dialog.getByLabel('באחריות').click();
  await page.getByRole('option', { name: 'רונית הממונה' }).click();
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(pending).toContainText(String(before - 2));
  expect(fleet.tables.safety_event_reviews[1]).toMatchObject({
    status: 'coaching',
    assigned_to: 'p1',
    self_review: false,
  });
});
