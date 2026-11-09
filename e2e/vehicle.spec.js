import { test, expect, gotoReady, axe, formatViolations, FLEET } from './fixtures';

const month = new Date().toISOString().slice(0, 7);
const tables = {
  vehicles: [{ id: 'veh1', plate_number: '12-345-67' }],
  current_assignments: [{ vehicle_id: 'veh1', driver_id: 'd1' }],
  drivers: [{ full_name: 'דנה לוי' }],
  work_orders: [
    { id: 'w1', number: 41, title: 'טיפול 30,000', status: 'open', total_cost: 0 },
    { id: 'w2', number: 33, title: 'החלפת צמיגים', status: 'done', total_cost: 2400 },
  ],
  vehicle_monthly_costs: [
    { month: `${month}-01`, category: 'fuel', amount: 820.5 },
    { month: `${month}-01`, category: 'maintenance', amount: 450 },
  ],
};

test('the vehicle card shows who drives it, what it costs and what is open', async ({ page }) => {
  await page.route('**/api/session/token', (route) => route.fulfill({ body: 'token' }));
  await page.route(`${FLEET}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/functions/v1/traccar-auth')) {
      return route.fulfill({
        json: {
          access_token: 'jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: 'p1', org_id: 'o1', role: 'manager' },
          permissions: ['vehicles.read', 'maintenance.read', 'costs.read'],
        },
      });
    }
    const rows = tables[url.pathname.split('/').at(-1)] || [];
    if ((request.headers().accept || '').includes('vnd.pgrst.object')) {
      return rows.length
        ? route.fulfill({ json: rows[0] })
        : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
    }
    return route.fulfill({ json: rows });
  });

  await gotoReady(page, '/fleet/vehicles');
  await page.getByRole('link', { name: 'Delivery Van' }).click();
  await expect(page).toHaveURL(/\/fleet\/vehicle\/1$/);
  await expect(page.getByText('נהג: דנה לוי')).toBeVisible();
  await expect(page.getByText(/1,270\.50/)).toBeVisible();
  // The demo's maintenance plan and this month's distance come from Traccar.
  await expect(page.getByText('Oil service')).toBeVisible();

  await page.getByRole('tab', { name: 'תחזוקה' }).click();
  await expect(page).toHaveURL(/tab=maintenance/);
  await expect(page.getByRole('link', { name: '#41' })).toHaveAttribute(
    'href',
    '/fleet/work-order/w1',
  );
  const { violations } = await axe(page).analyze();
  expect(formatViolations(violations)).toBe('');
});
