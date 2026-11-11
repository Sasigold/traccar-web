import { test, expect, gotoReady } from './fixtures';

// LIV-11: what filters the list is always in view, with a count and a way out.
test('a search shows "1 of 6", a chip to remove, and an empty result says how to clear it', async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  const search = page.getByRole('textbox', { name: /חיפוש/ }).first();
  await search.fill('Courier');
  const active = page.getByRole('region', { name: 'מסננים פעילים' });
  await expect(active.getByRole('status')).toHaveText('1 מתוך 6');

  await search.fill('zzzz');
  await expect(page.getByText('אין רכבים שתואמים לסינון')).toBeVisible();
  await page.getByRole('button', { name: 'ניקוי סינון' }).first().click();
  await expect(active).toHaveCount(0);
  await expect(search).toHaveValue('');
});

// LIV-22: the list by group, with headers that count and fold.
test('the list sorted by group has headers that count and fold', async ({ page, isMobile }) => {
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await page.getByRole('button', { name: 'סינון' }).first().click();
  await page.getByLabel('מיון לפי').click();
  await page.getByRole('option', { name: 'לפי קבוצה' }).click();
  await page.keyboard.press('Escape');
  const header = page.getByRole('button', { name: /: \d+ רכבים$/ }).first();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  const rowsBefore = await page.locator('[data-row]').count();
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.locator('[data-row]').count()).toBeLessThan(rowsBefore);
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
});

// AI-06: a vehicle reporting fault codes is marked in the list.
test('a vehicle with fault codes is marked as needing a check', async ({ page, isMobile }) => {
  const mark = (positions) =>
    positions.map((position) =>
      position.deviceId === 1
        ? { ...position, attributes: { ...position.attributes, dtcs: 'P0420' } }
        : position,
    );
  await page.route('**/api/positions', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: mark(await response.json()) });
  });
  await page.routeWebSocket(/\/api\/socket/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const data = JSON.parse(String(message));
      if (data.positions) data.positions = mark(data.positions);
      ws.send(JSON.stringify(data));
    });
    ws.onMessage((message) => server.send(message));
  });
  await gotoReady(page, '/');
  if (isMobile) {
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  }
  await expect(
    page.getByRole('button', { name: /Delivery Van.*כדאי לבדוק במוסך: קודי תקלה P0420/ }),
  ).toBeVisible();
});
