import { test, expect, gotoReady } from './fixtures';

// Every visual row is exactly full: its cells span the whole row and every stack is as
// tall as the row. This is the "no empty gaps" promise of the dashboard.
const expectGapless = async (page) => {
  // Let the reflow animation finish before measuring.
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('[data-flip]')]
      .reduce((result, item) => {
        const row = item.parentElement.parentElement;
        if (!result.some((entry) => entry.row === row)) {
          result.push({ row });
        }
        return result;
      }, [])
      .map(({ row }) => {
        const box = row.getBoundingClientRect();
        const cells = [...row.children].filter((child) => child.style.gridColumn);
        const left = Math.min(...cells.map((cell) => cell.getBoundingClientRect().left));
        const right = Math.max(...cells.map((cell) => cell.getBoundingClientRect().right));
        const stacks = cells.map((cell) => {
          const items = [...cell.children].filter((child) => child.dataset.flip);
          const top = Math.min(...items.map((item) => item.getBoundingClientRect().top));
          const bottom = Math.max(...items.map((item) => item.getBoundingClientRect().bottom));
          return bottom - top - box.height;
        });
        return { width: right - left - box.width, stacks };
      }),
  );
  expect(rows.length).toBeGreaterThan(0);
  rows.forEach((row) => {
    expect(Math.abs(row.width)).toBeLessThanOrEqual(1);
    row.stacks.forEach((difference) => expect(Math.abs(difference)).toBeLessThanOrEqual(1));
  });
};

const widget = (page, title) => page.locator('section[data-widget-id]').filter({ hasText: title });

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await page.locator('[data-widget-id]').first().waitFor();
  });

  test('opens with the live operations dashboard, right to left', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'דשבורד' })).toBeVisible();
    await expect(widget(page, 'הצי עכשיו')).toContainText('6');
    await expect(widget(page, 'מצב חיבור')).toBeVisible();
    await expectGapless(page);
  });

  // REP-17: the arrows keep the preset and walk the calendar, named by month.
  test('the period arrows move a month at a time and name it', async ({ page }) => {
    const period = page.getByRole('combobox', { name: 'תקופה' });
    await period.click();
    await page.getByRole('option', { name: 'חודש נוכחי' }).click();
    const next = page.getByRole('button', { name: 'התקופה הבאה' });
    await expect(next).toBeDisabled();
    await page.getByRole('button', { name: 'התקופה הקודמת' }).click();
    await expect(period).toContainText('חודש קודם');
    await page.getByRole('button', { name: 'התקופה הקודמת' }).click();
    const twoBack = new Date();
    twoBack.setDate(1);
    twoBack.setMonth(twoBack.getMonth() - 2);
    await expect(period).toContainText(String(twoBack.getFullYear()));
    await expect(next).toBeEnabled();
    await next.click();
    await expect(period).toContainText('חודש קודם');
  });

  test('a period change reaches the activity widgets and the table view', async ({ page }) => {
    await page.getByRole('button', { name: 'דשבורד חדש' }).click();
    await page.getByRole('menuitem', { name: /פעילות/ }).click();
    await expect(page.getByRole('combobox', { name: 'תקופה' })).toContainText('7 הימים האחרונים');
    const trend = widget(page, 'ק"מ לאורך זמן');
    await trend.hover();
    await trend.getByRole('button', { name: 'הצגה כטבלה' }).click();
    await expect(trend.getByRole('row')).toHaveCount(8);
    await expectGapless(page);
  });

  test('customizing: add, change the form, resize, remove, undo, keep after reload', async ({
    page,
    isMobile,
  }) => {
    // About 17 s alone, but close to the 60 s limit when two workers share a small CI machine.
    test.slow();
    await page.getByRole('button', { name: 'התאמה אישית' }).click();
    await page.getByRole('button', { name: 'הוספת רכיב' }).click();
    await page.getByRole('button', { name: /אירועים לפי סוג/ }).click();
    await page.keyboard.press('Escape');
    const events = widget(page, 'אירועים לפי סוג');
    await expect(events).toBeVisible();
    await expectGapless(page);

    await events.getByRole('button', { name: 'שינוי התצוגה' }).click();
    await page.getByRole('menuitem', { name: 'טבעת' }).click();
    await expect(events.locator('.recharts-pie')).toBeVisible();

    await events.getByRole('button', { name: 'אפשרויות הרכיב' }).click();
    await page.getByRole('button', { name: 'רוחב 1' }).click();
    await page.keyboard.press('Escape');
    await expectGapless(page);

    if (!isMobile) {
      const separator = page.getByRole('separator', { name: 'שינוי רוחב' }).first();
      const before = await separator.getAttribute('aria-valuenow');
      await separator.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(separator).not.toHaveAttribute('aria-valuenow', before);
      await expectGapless(page);
      await page.getByRole('button', { name: 'ביטול פעולה' }).click();
      await expect(separator).toHaveAttribute('aria-valuenow', before);
    }

    await widget(page, 'דיווח אחרון').getByRole('button', { name: 'אפשרויות הרכיב' }).click();
    await page.getByRole('menuitem', { name: 'הסרה' }).click();
    await expect(widget(page, 'דיווח אחרון')).toHaveCount(0);
    await expectGapless(page);

    await page.getByRole('button', { name: 'סיום' }).click();
    await page.reload();
    await page.locator('[data-widget-id]').first().waitFor();
    await expect(widget(page, 'אירועים לפי סוג')).toBeVisible();
    await expect(widget(page, 'דיווח אחרון')).toHaveCount(0);
  });

  test('cancel restores the layout from before editing', async ({ page, isMobile }) => {
    test.skip(isMobile, 'cancel is in the desktop toolbar');
    await page.getByRole('button', { name: 'התאמה אישית' }).click();
    await widget(page, 'דיווח אחרון').getByRole('button', { name: 'אפשרויות הרכיב' }).click();
    await page.getByRole('menuitem', { name: 'הסרה' }).click();
    await page.getByRole('button', { name: 'ביטול', exact: true }).click();
    await expect(widget(page, 'דיווח אחרון')).toBeVisible();
  });

  test('dragging a widget onto the edge of another moves it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'drag and drop is for mouse and pen');
    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.getByRole('button', { name: 'התאמה אישית' }).click();
    const handle = widget(page, 'מהירות עכשיו').getByRole('button', { name: 'הזזה' });
    const from = await handle.boundingBox();
    const target = await widget(page, 'הצי עכשיו').boundingBox();
    await page.mouse.move(from.x + 8, from.y + 8);
    await page.mouse.down();
    await page.mouse.move(target.x + 20, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();
    // Positions settle after the reflow animation.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const top = (title) =>
            [...document.querySelectorAll('section[data-widget-id]')]
              .find((section) => section.textContent.includes(title))
              .getBoundingClientRect().top;
          return Math.abs(top('מהירות עכשיו') - top('הצי עכשיו')) < 2;
        }),
      )
      .toBe(true);
    await expectGapless(page);
  });

  test('phones get one column and no drag handles', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.getByRole('button', { name: 'התאמה אישית' }).click();
    await expect(page.getByRole('button', { name: 'הזזה' })).toHaveCount(0);
    await expectGapless(page);
  });
});

test.afterEach(({ pageErrors }) => {
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

// REP-21: widgets load as still shapes, not a pulsing logo each.
test('loading widgets show their shape, not the brand loader', async ({ page }) => {
  await page.route('**/api/reports/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fallback();
  });
  await gotoReady(page, '/dashboard');
  await page.getByRole('button', { name: 'דשבורד חדש' }).click();
  await page.getByRole('menuitem', { name: /פעילות/ }).click();
  await expect(page.locator('[data-widget-id] [role="status"]').first()).toBeVisible();
  await expect(page.locator('[data-widget-id] .vf-loader')).toHaveCount(0);
});
