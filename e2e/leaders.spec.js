import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// SAF-05: this week's leaders, ranked within the group of the vehicle each drove most.
test("this week's leaders are ranked in groups", async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['safety.read'] },
    },
    rpc: { fleet_features: ['safety'] },
    tables: { safety_settings: [], safety_event_reviews: [], vehicle_driver_assignments: [] },
  });
  await gotoReady(page, '/fleet/safety?view=leaders');
  await expect(page.getByRole('button', { name: 'מובילי השבוע' })).toBeVisible();
  // A group heading row, then its drivers from rank 1.
  await expect(page.getByRole('cell', { name: '1', exact: true }).first()).toBeVisible();
  await expect(page.getByText(/בלי אירוע|—/).first()).toBeVisible();
});

// ISR-07: the driving hours view still loads with the weekly rest rule and the allowance.
test('driving hours list each driver with their violations', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['safety.read'] },
    },
    rpc: { fleet_features: ['safety'] },
    tables: {},
  });
  await gotoReady(page, '/fleet/safety?view=hours');
  await expect(page.getByRole('button', { name: 'שעות נהיגה' })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: /\d/ }).first()).toBeVisible();
});

// ISR-07: a temporary permit shows on the drivers it covers, and is added in the settings with
// rules per kind of vehicle.
test('a temporary permit covers the drivers and is set in the settings', async ({ page }) => {
  await writeMode(page);
  const pad = (n) => String(n).padStart(2, '0');
  const day = (offset) => {
    const d = new Date(Date.now() + offset * 86400000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const fleet = await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'manager' },
        permissions: ['safety.read', 'safety.write'],
      },
    },
    rpc: { fleet_features: ['safety'] },
    tables: {
      org_safety_settings: [
        {
          org_id: 'o1',
          score_weights: {},
          hours_rules: {
            permits: [
              {
                id: 'x1',
                name: 'היתר חירום',
                from: day(-1),
                to: day(1),
                classes: [],
                rules: { maxDailyDriving: 840 },
              },
            ],
          },
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/safety?view=hours');
  await expect(page.getByText('היתר: היתר חירום').first()).toBeVisible();

  await page.getByRole('button', { name: 'הגדרות בטיחות' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'רכב כבד' }).click();
  await dialog.getByRole('spinbutton', { name: 'נהיגה מרבית ביום' }).nth(1).fill('540');
  await expect(dialog.getByText('היתר חירום', { exact: true })).toBeVisible();
  await dialog.getByRole('textbox', { name: 'שם ההיתר' }).fill('היתר חג');
  await dialog.getByRole('button', { name: 'הסרה היתר חירום' }).click();
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  const saved = fleet.tables.org_safety_settings[0].hours_rules;
  expect(saved.byClass.heavy.maxDailyDriving).toBe(540);
  expect(saved.permits).toEqual([]);
});
