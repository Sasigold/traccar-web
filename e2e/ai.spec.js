import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// AI (AI-01..04): the model key stays on the server; the browser calls the fleet-ai function.
const manager = {
  profile: { id: 'p1', org_id: 'o1', role: 'admin' },
  permissions: ['maintenance.read', 'maintenance.write', 'users.manage'],
};

const library = [
  {
    code: 'P0420',
    title_he: 'יעילות הממיר הקטליטי נמוכה',
    explanation_he: 'הממיר לא מנקה את הפליטה כמו שצריך.',
    severity: 'medium',
    drive_today: 'yes',
    cost_min: 800,
    cost_max: 4500,
    source: 'library',
  },
];

const selectServiceVan = async (page, isMobile) => {
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByText('Service Van').first().click();
};

test('a fault code becomes a decision: what it is, can the day go on, what next', async ({
  page,
  isMobile,
}) => {
  await writeMode(page);
  const calls = [];
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['ai', 'workOrders'] },
    tables: { dtc_library: library },
    functions: {
      'fleet-ai/dtc': (body) => {
        calls.push(body);
        return {
          items: [
            library[0],
            {
              code: 'P0171',
              title_he: 'תערובת דלה',
              explanation_he: 'דליפת ואקום או חיישן אוויר.',
              severity: 'medium',
              drive_today: 'caution',
              cost_min: 200,
              cost_max: 1500,
              source: 'ai',
            },
          ],
        };
      },
    },
  });
  await gotoReady(page, '/');
  await selectServiceVan(page, isMobile);
  if (isMobile) {
    await page.getByRole('button', { name: 'הרחבת הכרטיס' }).click();
  }
  await page.getByRole('button', { name: 'מה זה P0171?' }).click();
  const dialog = page.getByRole('dialog', { name: 'קודי תקלה' });
  await expect(dialog.getByRole('heading', { name: 'תערובת דלה' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'יעילות הממיר הקטליטי נמוכה' })).toBeVisible();
  await expect(dialog.getByText('בזהירות: לסיים את היום')).toBeVisible();
  await expect(dialog.getByText('עלות משוערת: ₪800 עד ₪4,500')).toBeVisible();
  await expect(dialog.getByText('ההסבר נכתב על ידי AI')).toHaveCount(1);
  // Only the code missing from the library went to the model.
  expect(calls).toEqual([{ codes: ['P0171', 'P0420'] }]);

  await dialog
    .getByRole('heading', { name: 'תערובת דלה' })
    .locator('xpath=ancestor::div[contains(@class,"MuiPaper")][1]')
    .getByRole('link', { name: 'פתיחת הזמנת עבודה' })
    .click();
  await expect(page).toHaveURL(/\/fleet\/work-order\?deviceId=2&type=repair&title=P0171/);
});

test('without AI the library still explains known codes', async ({ page, isMobile }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['workOrders'] },
    tables: { dtc_library: library },
  });
  await gotoReady(page, '/');
  await selectServiceVan(page, isMobile);
  if (isMobile) {
    await page.getByRole('button', { name: 'הרחבת הכרטיס' }).click();
  }
  await page.getByRole('button', { name: 'מה זה P0420?' }).click();
  const dialog = page.getByRole('dialog', { name: 'קודי תקלה' });
  await expect(dialog.getByRole('heading', { name: 'יעילות הממיר הקטליטי נמוכה' })).toBeVisible();
  await expect(dialog.getByText('קוד לא מוכר')).toBeVisible();
});
