import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ISR-14: Waze wherever there is a place: the vehicle card, points of interest and vendors.
test('navigate to the vehicle with Waze from its card', async ({ page, isMobile }) => {
  await gotoReady(page, '/');
  await expect(page.getByRole('button', { name: 'כל הצי' })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'רשימת רכבים' }).click();
  await page.getByText('Delivery Van').first().click();
  await page.getByRole('button', { name: 'פעולות נוספות' }).click();
  await expect(page.getByRole('menuitem', { name: 'ניווט אל הרכב (Waze)' })).toHaveAttribute(
    'href',
    /^https:\/\/waze\.com\/ul\?ll=-?[\d.]+,-?[\d.]+&navigate=yes$/,
  );
});

test('points of interest and vendors link to Waze', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: {
        profile: { id: 'p1', org_id: 'o1', role: 'admin' },
        permissions: ['poi.read', 'maintenance.read'],
      },
    },
    tables: {
      pois: [
        {
          id: 'a',
          org_id: 'o1',
          name: 'מחסן צפון',
          category: 'warehouse',
          address: 'החרושת 4, חיפה',
          latitude: 32.79,
          longitude: 35.01,
        },
        { id: 'b', org_id: 'o1', name: 'בלי מקום', category: 'other' },
      ],
      vendors: [
        { id: 'v', org_id: 'o1', name: 'מוסך הצפון', type: 'garage', address: 'הנמל 3, חיפה' },
      ],
    },
  });
  await gotoReady(page, '/fleet/poi');
  await expect(page.getByRole('link', { name: 'ניווט ב-Waze: מחסן צפון' })).toHaveAttribute(
    'href',
    'https://waze.com/ul?ll=32.79,35.01&navigate=yes',
  );
  await expect(page.getByRole('link', { name: /ניווט ב-Waze: בלי מקום/ })).toHaveCount(0);

  await gotoReady(page, '/fleet/vendors');
  await expect(page.getByRole('link', { name: 'ניווט ב-Waze: מוסך הצפון' })).toHaveAttribute(
    'href',
    `https://waze.com/ul?q=${encodeURIComponent('הנמל 3, חיפה')}&navigate=yes`,
  );
});
