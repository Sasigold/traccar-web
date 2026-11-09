import { Buffer } from 'node:buffer';
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

test('a question from Ctrl+K: the data comes from tools run here, the answer has a table', async ({
  page,
}) => {
  await writeMode(page);
  const asks = [];
  const period = { from: '2026-11-01T00:00:00.000Z', to: '2026-11-08T00:00:00.000Z' };
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['ai'] },
    functions: {
      'fleet-ai/ask': (body) => {
        asks.push(body);
        if (asks.length === 1) {
          return {
            stop_reason: 'tool_use',
            content: [
              { type: 'tool_use', id: 't1', name: 'list_vehicles', input: {} },
              {
                type: 'tool_use',
                id: 't2',
                name: 'fleet_summary',
                input: { period, vehicle_ids: [1] },
              },
            ],
          };
        }
        return {
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'Delivery Van נסע הכי הרבה השבוע.' },
            {
              type: 'tool_use',
              id: 't3',
              name: 'show_table',
              input: { columns: ['רכב', 'ק"מ'], rows: [['Delivery Van', '412']] },
            },
            {
              type: 'tool_use',
              id: 't4',
              name: 'suggest_followups',
              input: { questions: ['ומי נסע הכי מעט?'] },
            },
          ],
        };
      },
    },
  });
  await gotoReady(page, '/');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('מי נסע הכי הרבה השבוע?');
  await page.getByRole('option', { name: /שאלה ל-AI/ }).click();

  const panel = page.getByRole('dialog', { name: 'שאלה על הצי' });
  await expect(panel.getByText('Delivery Van נסע הכי הרבה השבוע.')).toBeVisible();
  await expect(panel.getByRole('cell', { name: '412' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'ומי נסע הכי מעט?' })).toBeVisible();

  // The second call carries what the tools found, with the user's own data.
  expect(asks).toHaveLength(2);
  const results = asks[1].messages.at(-1).content;
  expect(results.map((result) => result.tool_use_id)).toEqual(['t1', 't2']);
  expect(results[0].content).toContain('Delivery Van');
  expect(results[1].is_error).toBeFalsy();

  await panel.getByRole('link', { name: /פתיחה כדוח/ }).click();
  await expect(page).toHaveURL(/\/reports\/summary\?from=.*deviceId=1/);
});

test('a photo of the vehicle license fills the form, and nothing is saved until Save', async ({
  page,
}) => {
  await writeMode(page);
  const sent = [];
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['ai'] },
    functions: {
      'fleet-ai/extract': (body) => {
        sent.push(body);
        return {
          fields: {
            plate_number: '1234567',
            test_expiry: '2027-03-01',
            make: 'Ford',
            model: 'Transit Custom',
            model_year: 2022,
            vin: null,
            owner_name: 'הובלות הצפון',
          },
          unsure: ['test_expiry'],
        };
      },
    },
  });
  const writes = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && /\/api\/devices\/1$/.test(request.url())) writes.push(1);
  });
  await gotoReady(page, '/settings/device/1');
  await page.getByLabel('סריקת רישיון רכב').setInputFiles({
    name: 'license.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgo=', 'base64'),
  });
  const dialog = page.getByRole('dialog', { name: 'סריקת רישיון רכב' });
  await expect(dialog.getByRole('status')).toHaveText(/בדקו את 1 השדות המסומנים/);
  await expect(dialog.getByRole('row', { name: /תוקף טסט/ }).getByText('לבדוק')).toBeVisible();
  expect(sent[0]).toMatchObject({ kind: 'vehicle_license', media_type: 'image/png' });
  await dialog.getByRole('button', { name: 'מילוי הטופס' }).click();
  await expect(page.locator('input[value="Transit Custom"]')).toBeVisible();
  expect(writes).toHaveLength(0);
});

test('a garage invoice becomes the work order lines', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: { 1: manager },
    rpc: { fleet_features: ['ai', 'workOrders'] },
    functions: {
      'fleet-ai/extract': () => ({
        fields: {
          vendor_name: 'מוסך הצפון',
          invoice_number: 'A-77',
          date: '2026-11-05',
          plate_number: '1234567',
          odometer: 84000,
          lines: [
            { description: 'רפידות בלם', kind: 'part', quantity: 2, amount: 400 },
            { description: 'עבודה', kind: 'labor', quantity: 1, amount: 250 },
          ],
          subtotal: 650,
          vat: 110.5,
          total: 760.5,
        },
        unsure: [],
      }),
    },
  });
  await gotoReady(page, '/fleet/work-order');
  await page.getByLabel('סריקת חשבונית מוסך').setInputFiles({
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
  });
  await page.getByRole('dialog').getByRole('button', { name: 'מילוי הטופס' }).click();
  await expect(page.locator('input[value="רפידות בלם"]')).toBeVisible();
  await expect(page.locator('input[value="עבודה"]')).toBeVisible();
  await expect(page.getByLabel('מספר חשבונית')).toHaveValue('A-77');
});
