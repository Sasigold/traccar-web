import { describe, expect, it } from 'vitest';
import { periodStart, pivotCosts, withCostPerKm } from '../costs';

describe('costs', () => {
  it('pivots monthly rows per vehicle, most expensive first', () => {
    const { lines, totals } = pivotCosts([
      { vehicle_id: 'a', category: 'fuel', amount: '100.10' },
      { vehicle_id: 'a', category: 'fuel', amount: 50 },
      { vehicle_id: 'b', category: 'maintenance', amount: 500 },
      { vehicle_id: 'a', category: 'toll', amount: 25 },
      { vehicle_id: 'a', category: 'lease', amount: 10 },
    ]);
    expect(lines).toEqual([
      { vehicleId: 'b', fuel: 0, maintenance: 500, other: 0, total: 500 },
      { vehicleId: 'a', fuel: 150.1, maintenance: 0, other: 35, total: 185.1 },
    ]);
    expect(totals).toEqual({ fuel: 150.1, maintenance: 500, other: 35, total: 685.1 });
  });

  it('starts the period on the first of the month', () => {
    expect(periodStart(1, new Date(2026, 10, 6))).toBe('2026-11-01');
    expect(periodStart(12, new Date(2026, 10, 6))).toBe('2025-12-01');
  });
});

describe('cost per kilometre (ADM-18)', () => {
  it('divides each vehicle by the distance it drove, and leaves it empty without one', () => {
    const lines = withCostPerKm(
      [
        { vehicleId: 'a', total: 1500 },
        { vehicleId: 'b', total: 200 },
      ],
      { a: 1000000 },
    );
    expect(lines[0]).toMatchObject({ km: 1000, perKm: 1.5 });
    expect(lines[1]).toMatchObject({ km: null, perKm: null });
  });
});
