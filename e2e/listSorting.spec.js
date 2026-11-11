import { test, expect, gotoReady } from './fixtures';
import { fakeFleet, writeMode } from './fakeFleet';

// ADM-15: a fleet list sorts by its headers, and the chip, the search and the order are in
// the address, so a reload or a shared link shows the same list.
const incident = (number, cost, status = 'reported') => ({
  id: `i${number}`,
  org_id: 'o1',
  number,
  occurred_at: new Date(Date.now() - number * 3600000).toISOString(),
  type: 'accident',
  severity: 'minor',
  status,
  repair_cost: cost,
});

test('the incidents list sorts by a header and keeps the view in the address', async ({ page }) => {
  await writeMode(page);
  await fakeFleet(page, {
    users: {
      1: { profile: { id: 'p1', org_id: 'o1', role: 'manager' }, permissions: ['incidents.read'] },
    },
    rpc: { fleet_features: ['incidents'] },
    tables: {
      incidents: [
        incident(1, 900),
        incident(2, 150),
        incident(3, null),
        incident(4, 4200, 'closed'),
      ],
      vehicles: [],
      drivers: [],
    },
  });
  await gotoReady(page, '/fleet/incidents');
  const numbers = () =>
    page.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.cells[0].textContent));
  await expect.poll(numbers).toEqual(['1', '2', '3']);

  await page.getByRole('button', { name: 'הכל' }).click();
  if (test.info().project.name === 'mobile') {
    // Phones show cards without the header: the order is chosen from a list.
    await page.getByLabel('מיון לפי').click();
    await page.getByRole('option', { name: 'עלות תיקון' }).click();
    await expect.poll(numbers).toEqual(['2', '1', '4', '3']);
    await page.getByRole('button', { name: 'סדר יורד' }).click();
  } else {
    const cost = page.getByRole('button', { name: 'עלות תיקון' });
    await cost.click();
    await expect.poll(numbers).toEqual(['2', '1', '4', '3']);
    await cost.click();
    await expect(page.getByRole('columnheader', { name: 'עלות תיקון' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  }
  await expect.poll(numbers).toEqual(['4', '1', '2', '3']);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('repair_cost');

  await page.reload();
  await expect.poll(numbers).toEqual(['4', '1', '2', '3']);
});
