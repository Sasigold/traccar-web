import { test, expect, gotoReady } from './fixtures';

// LIV-23: "Today", the phone's first tab: a greeting, vehicles moving, tiles and shortcuts.
test.describe('today on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phones only');

  test('the first tab sums up the day and leads to the map, filtered', async ({ page }) => {
    await gotoReady(page, '/');
    const tabs = page.getByRole('navigation', { name: 'ניווט' }).getByRole('button');
    await expect(tabs.first()).toHaveAccessibleName('היום');
    await tabs.first().click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^שלום/);

    const moving = page.getByRole('button', { name: /רכבים בתנועה/ });
    await expect(moving).toHaveAccessibleName(/^\d+ רכבים בתנועה$/);
    await expect(page.getByRole('button', { name: /עומדים/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /מנותקים/ })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'קיצורים' }).getByRole('button', { name: /דוח נסיעות/ }),
    ).toBeVisible();

    await moving.click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button', { name: 'רשימת רכבים' }).click();
    await expect(page.getByRole('region', { name: 'מסננים פעילים' })).toBeVisible();
  });
});

test('"Today" is not in the desktop rail', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await gotoReady(page, '/');
  await expect(
    page.getByRole('navigation').first().getByRole('link', { name: 'היום' }),
  ).toHaveCount(0);
});
