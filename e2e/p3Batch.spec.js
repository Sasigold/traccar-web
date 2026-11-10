import { Buffer } from 'node:buffer';
import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

const admin = (permissions) => ({
  1: { profile: { id: 'p1', org_id: 'o1', role: 'admin' }, permissions },
});

// OPS-11: only what needs someone now: late or failed jobs, with their count on the chip.
test('the dispatch board shows its exceptions only', async ({ page }) => {
  await writeMode(page);
  const past = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const later = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  await fakeFleet(page, {
    users: admin(['dispatch.read', 'dispatch.write']),
    rpc: { fleet_features: ['dispatch'] },
    tables: {
      dispatch_jobs: [
        {
          id: 'j1',
          org_id: 'o1',
          number: 1,
          title: 'Late job',
          status: 'en_route',
          scheduled_at: past,
          window_end: past,
        },
        {
          id: 'j2',
          org_id: 'o1',
          number: 2,
          title: 'Failed job',
          status: 'failed',
          scheduled_at: past,
        },
        {
          id: 'j3',
          org_id: 'o1',
          number: 3,
          title: 'On time job',
          status: 'assigned',
          scheduled_at: later,
          window_end: later,
        },
      ],
      pois: [],
      vehicles: [],
      drivers: [],
    },
  });
  await gotoReady(page, '/fleet/dispatch');
  await page.getByRole('button', { name: 'חריגים · 2' }).click();
  await expect(page).toHaveURL(/filter=exceptions/);
  const main = page.getByRole('main');
  await expect(main.getByText('Late job')).toBeVisible();
  await expect(main.getByText('Failed job')).toBeVisible();
  await expect(main.getByText('On time job')).toHaveCount(0);
});

// AI-09: with consent, this fleet against the median of similar fleets.
test('the fleet hub compares with similar fleets', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: admin(['costs.read', 'users.manage']),
    tables: { organizations: [{ id: 'o1', name: 'Fleet', benchmark_opt_in: true }] },
    rpc: {
      fleet_benchmarks: () => [
        {
          metric: 'fuel_cost_per_vehicle_month',
          band: '1-10',
          mine: 900,
          median: 1100,
          best: 700,
          fleets: 8,
        },
        {
          metric: 'incidents_per_100_vehicles_year',
          band: '1-10',
          mine: 12,
          median: 8,
          best: 2,
          fleets: 8,
        },
      ],
    },
  });
  await gotoReady(page, '/fleet');
  const card = page.getByRole('region', { name: 'השוואה לציים דומים' });
  await expect(card.getByRole('row', { name: /דלק לרכב בחודש/ })).toContainText('טוב מהחציון');
  await expect(card.getByRole('row', { name: /תאונות ל-100 רכבים/ })).toContainText('מעל החציון');
});

// ISR-13: a work order's lines against the supplier's agreed prices.
test('a work order says when the invoice is above the agreed prices', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: admin(['maintenance.read', 'maintenance.write']),
    tables: {
      vehicles: [{ id: 'v1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' }],
      vendors: [{ id: 'g1', org_id: 'o1', name: 'מוסך הצפון', type: 'garage', active: true }],
      vendor_prices: [
        {
          id: 'vp1',
          org_id: 'o1',
          vendor_id: 'g1',
          description: 'החלפת שמן',
          kind: 'labor',
          unit_price: 200,
          tolerance_pct: 0,
        },
      ],
      work_orders: [
        {
          id: 'w1',
          org_id: 'o1',
          number: 7,
          vehicle_id: 'v1',
          vendor_id: 'g1',
          title: 'טיפול',
          status: 'open',
          opened_at: '2026-11-01',
          invoice_number: 'A-1',
        },
      ],
      work_order_items: [
        {
          id: 'i1',
          org_id: 'o1',
          work_order_id: 'w1',
          kind: 'labor',
          description: 'החלפת שמן',
          quantity: 1,
          unit_price: 260,
          sort_order: 0,
        },
      ],
      issues: [],
      maintenance_links: [],
    },
  });
  await gotoReady(page, '/fleet/work-order/w1');
  await expect(page.getByRole('status').filter({ hasText: 'מהמחירון המוסכם' })).toContainText(
    'החלפת שמן',
  );
});

// AI-10: a procedure becomes a course; the driver answers it and a pass is reported.
test('a course built from a procedure is reviewed and published', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: admin(['safety.read', 'safety.write']),
    rpc: { fleet_features: ['safety'] },
    tables: { training_courses: [], course_completions: [] },
    functions: {
      'fleet-ai/course': () => ({
        title: 'בדיקת בוקר',
        summary: 'מה בודקים לפני היציאה.',
        sections: [{ heading: 'צמיגים', points: ['בודקים לחץ אוויר'] }],
        quiz: [0, 1, 2].map((n) => ({
          question: `שאלה ${n + 1}`,
          options: ['א', 'ב', 'ג', 'ד'],
          answer: n,
          explanation: 'כך כתוב בנוהל.',
        })),
      }),
    },
  });
  await gotoReady(page, '/fleet/courses');
  await page.getByLabel('הדרכה מנוהל (PDF)').setInputFiles({
    name: 'procedure.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('שם ההדרכה')).toHaveValue('בדיקת בוקר');
  await expect(dialog.getByText('שאלה 3')).toBeVisible();
  await dialog.getByRole('button', { name: 'פרסום לנהגים' }).click();
  await expect(dialog).toBeHidden();
  expect(fleet.tables.training_courses[0]).toMatchObject({
    status: 'published',
    title: 'בדיקת בוקר',
  });
});

test('a driver takes a course and sees the result', async ({ page }) => {
  await writeMode(page);
  const submitted = [];
  await fakeFleet(page, {
    users: admin([]),
    rpc: {
      my_courses: () => [
        {
          id: 'c1',
          title: 'בדיקת בוקר',
          summary: 'מה בודקים.',
          sections: [{ heading: 'צמיגים', points: ['לחץ'] }],
          quiz: [
            { question: 'שאלה 1', options: ['א', 'ב', 'ג', 'ד'] },
            { question: 'שאלה 2', options: ['א', 'ב', 'ג', 'ד'] },
          ],
          pass_score: 100,
          passed: false,
        },
      ],
      submit_course: (body) => {
        submitted.push(body);
        return {
          score: 50,
          passed: false,
          answers: [
            { answer: 0, explanation: 'הסבר 1' },
            { answer: 2, explanation: 'הסבר 2' },
          ],
        };
      },
    },
  });
  await gotoReady(page, '/driver/course/c1');
  await page.getByRole('radiogroup', { name: '1. שאלה 1' }).getByLabel('א').check();
  await page.getByRole('radiogroup', { name: '2. שאלה 2' }).getByLabel('ב').check();
  await page.getByRole('button', { name: 'שליחת התשובות' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ציון 50' })).toBeVisible();
  await expect(page.getByText('התשובה הנכונה: ג. הסבר 2')).toBeVisible();
  expect(submitted[0]).toEqual({ p_course: 'c1', p_answers: [0, 1] });
  await page.getByRole('button', { name: 'ניסיון נוסף' }).click();
  await expect(page.getByRole('button', { name: 'שליחת התשובות' })).toBeDisabled();
});

// LIV-26: the whole fleet at a past moment, and back to live.
test('the map rewinds the fleet and comes back to live', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same control; the slider is driven by keyboard here');
  await gotoReady(page, '/');
  await page.getByRole('button', { name: 'איפה היו כולם? (הרצה אחורה)' }).click();
  const bar = page.getByRole('group', { name: 'הצי בזמן שנבחר' });
  const slider = bar.getByRole('slider');
  await slider.focus();
  const request = page.waitForRequest(/api\/reports\/route/);
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await request;
  await expect(bar.getByRole('status')).toHaveText(/\d{2}:\d{2}/);
  await bar.getByRole('button', { name: 'זמן אמת' }).click();
  await expect(bar.getByRole('status')).toHaveCount(0);
});

// OPS-07: tires per wheel, a replacement, and tread depth against the legal minimum.
test('a vehicle keeps its tires and their tread', async ({ page }) => {
  await writeMode(page);
  const fleet = await fakeFleet(page, {
    users: admin(['vehicles.read', 'maintenance.read', 'maintenance.write']),
    tables: {
      vehicles: [{ id: 'v1', org_id: 'o1', traccar_device_id: 1, plate_number: '12-345-67' }],
      vehicle_tires: [],
      tire_tread_readings: [],
    },
  });
  await gotoReady(page, '/fleet/vehicle/1?tab=maintenance');
  const tires = page.getByRole('region', { name: 'צמיגים' });
  await expect(tires.getByText('עוד לא נרשמו צמיגים לרכב.')).toBeVisible();
  await tires.getByRole('button', { name: 'הוספת צמיג' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('יצרן').fill('Michelin');
  await dialog.getByLabel('מחיר (₪)').fill('600');
  await dialog.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(tires.getByRole('row', { name: /קדמי שמאלי/ })).toContainText('Michelin');
  expect(fleet.tables.vehicle_tires[0]).toMatchObject({
    position: 'fl',
    cost: 600,
    vehicle_id: 'v1',
  });

  await tires.getByRole('button', { name: 'מדידת עומק חריץ' }).click();
  await page.getByRole('dialog').getByLabel('עומק חריץ (מ"מ)').fill('1,2');
  await page.getByRole('dialog').getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(tires.getByRole('alert').or(tires.locator('.MuiAlert-root'))).toContainText(
    'מתחת למינימום החוקי',
  );
});

// SAF-07: weather where vehicles are, when switched on.
test('a weather alert names the vehicles in a storm', async ({ page, isMobile }) => {
  await page.route('**/api/session', async (route) => {
    const response = await route.fetch();
    const user = await response.json();
    await route.fulfill({
      response,
      json: { ...user, attributes: { ...user.attributes, weatherAlerts: true } },
    });
  });
  const asked = [];
  await page.route('https://api.open-meteo.com/**', (route) => {
    const url = new URL(route.request().url());
    asked.push(url);
    const count = url.searchParams.get('latitude').split(',').length;
    const answer = Array.from({ length: count }, () => ({
      current: { precipitation: 12, weather_code: 95, temperature_2m: 18 },
    }));
    return route.fulfill({ json: count === 1 ? answer[0] : answer });
  });
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await expect(page.getByText(/גשם חזק או סערה באזור של/)).toBeVisible();
  await expect(page.getByText('סף המהירות בתנאים כאלה: 80% מהרגיל.').first()).toBeVisible();
  // Only coarse cells leave the app.
  asked[0].searchParams
    .get('latitude')
    .split(',')
    .forEach((value) => expect(Number(value) % 0.25).toBeCloseTo(0));
});

// ADM-29: one searchable vehicle picker in the forms, by name or plate.
test('the fuel form finds a vehicle by its plate', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: admin(['costs.read', 'costs.write', 'vehicles.read']),
    tables: { vehicles: [], fuel_transactions: [] },
  });
  await gotoReady(page, '/fleet/costs');
  await page.getByRole('button', { name: 'דלק', exact: true }).click();
  await page.getByRole('button', { name: 'תדלוק ידני' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'רכב' }).fill('12-345');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.getByRole('option', { name: /Delivery Van/ }).click();
  await expect(dialog.getByRole('combobox', { name: 'רכב' })).toHaveValue(/Delivery Van/);
});

// OPS-09: the usage report tells which vehicles could be electric by their driving days.
test('the usage report says which vehicles could be electric', async ({ page }) => {
  const days = Array.from({ length: 6 }, (_, i) => ({
    deviceId: 1,
    startTime: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    endTime: new Date(Date.now() - (i + 1) * 86400000 + 3600000).toISOString(),
    distance: (i === 2 ? 320 : 80) * 1000,
    duration: 3600000,
  }));
  await page.route('**/api/reports/trips?*', (route) => route.fulfill({ json: days }));
  await page.route('**/api/reports/stops?*', (route) => route.fulfill({ json: [] }));
  await gotoReady(page, '/reports/usage?deviceId=1&period=last7');
  await page.getByRole('button', { name: 'הצג', exact: true }).click();
  const row = page.getByRole('main').getByRole('row', { name: /Delivery Van/ });
  await expect(row).toContainText(/לא \(היום הארוך: 320/);
});

// OPS-08: equipment is where the vehicle that saw its tag is.
test('equipment with a BLE tag shows the vehicle that saw it', async ({ page }) => {
  await writeMode(page);
  await page.route('**/api/positions', async (route) => {
    const response = await route.fetch();
    const positions = await response.json();
    await route.fulfill({
      response,
      json: positions.map((position) =>
        position.deviceId === 2
          ? { ...position, attributes: { ...position.attributes, tag1Mac: 'AA:BB:CC:DD:EE:01' } }
          : position,
      ),
    });
  });
  // Live updates too: the vehicle's tracker reports the tag it sees.
  await page.routeWebSocket(/\/api\/socket/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const data = JSON.parse(String(message));
      (data.positions || []).forEach((position) => {
        if (position.deviceId === 2) position.attributes.tag1Mac = 'AA:BB:CC:DD:EE:01';
      });
      ws.send(JSON.stringify(data));
    });
    ws.onMessage((message) => server.send(message));
  });
  await fakeFleet(page, {
    users: admin(['vehicles.read', 'vehicles.write']),
    rpc: { fleet_features: ['equipment'] },
    tables: {
      vehicles: [
        {
          id: 'e1',
          org_id: 'o1',
          asset_kind: 'equipment',
          plate_number: 'GEN-7',
          ble_tag: 'aa-bb-cc-dd-ee-01',
        },
      ],
    },
  });
  await gotoReady(page, '/fleet/equipment');
  await expect(page.getByRole('row', { name: /GEN-7/ })).toContainText(/ליד .+ · /);
});

// LIV-28: picked vehicles open side by side, each on its own following map.
test('picked vehicles are followed side by side', async ({ page, isMobile }) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByRole('button', { name: 'בחירת כמה רכבים' }).click();
  const rows = page.locator('[aria-pressed]').filter({ hasText: /Courier|Van/ });
  await rows.nth(0).click();
  await rows.nth(1).click();
  await page.getByRole('button', { name: 'מעקב במקביל' }).click();
  await expect(page).toHaveURL(/\/follow\?ids=\d+,\d+/);
  const tiles = page.locator('section').filter({ has: page.locator('canvas') });
  await expect(tiles).toHaveCount(2);
  await expect(tiles.first().locator('canvas')).toBeVisible();
});
