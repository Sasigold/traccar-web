import { test, expect, gotoReady } from './fixtures';

// REP-18: a chart says its unit, and a widget can carry a target.
const widget = (page, title) => page.locator('section[data-widget-id]').filter({ hasText: title });

test('a target is a dashed line, and the unit is written with the chart', async ({
  page,
  isMobile,
}) => {
  test.slow();
  await gotoReady(page, '/dashboard');
  await page.locator('[data-widget-id]').first().waitFor();
  await page.getByRole('button', { name: 'התאמה אישית' }).click();
  await page.getByRole('button', { name: 'הוספת רכיב' }).click();
  await page.getByRole('button', { name: /ק"מ לאורך זמן/ }).click();
  await page.keyboard.press('Escape');
  const chart = widget(page, 'ק"מ לאורך זמן');
  await expect(chart).toBeVisible();
  await chart.getByRole('button', { name: 'אפשרויות הרכיב' }).click();
  await page.getByRole('menuitem', { name: 'הגדרות הרכיב' }).click();
  const dialog = page.getByRole('dialog', { name: 'הגדרות הרכיב' });
  await dialog.getByLabel('יעד').fill('5');
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  if (!isMobile) await page.getByRole('button', { name: 'סיום' }).click();
  await expect(chart.locator('figcaption')).toHaveText('ק"מ');
  await expect(chart.locator('.recharts-reference-line line')).toHaveAttribute(
    'stroke-dasharray',
    '5 4',
  );
});
