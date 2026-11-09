import { describe, expect, it } from 'vitest';
import { monthCost, nearestExpiry, nextMaintenance, openWorkOrders } from '../vehicle360';

describe('vehicle card tiles', () => {
  it('sums the month', () => {
    const rows = [
      { month: '2026-11-01', amount: '120.5' },
      { month: '2026-11-01T00:00:00', amount: 79.5 },
      { month: '2026-10-01', amount: 1000 },
    ];
    expect(monthCost(rows, '2026-11-01')).toBe(200);
  });

  it('counts open work orders only', () => {
    const rows = [
      { status: 'open' },
      { status: 'in_shop' },
      { status: 'done' },
      { status: 'planned' },
    ];
    expect(openWorkOrders(rows)).toHaveLength(3);
  });

  it('finds the nearest validity date of this vehicle', () => {
    const rows = [
      { entity: 'vehicle', entityId: 1, days: 40 },
      { entity: 'vehicle', entityId: 1, days: -3 },
      { entity: 'vehicle', entityId: 2, days: -10 },
      { entity: 'driver', entityId: 1, days: -20 },
    ];
    expect(nearestExpiry(rows, 1).days).toBe(-3);
    expect(nearestExpiry(rows, 9)).toBeNull();
  });

  it('picks the most urgent maintenance', () => {
    const position = { attributes: { totalDistance: 98_000_000 } };
    const oil = { id: 1, name: 'שמן', type: 'totalDistance', start: 0, period: 10_000_000 };
    const tires = { id: 2, name: 'צמיגים', type: 'totalDistance', start: 0, period: 40_000_000 };
    expect(nextMaintenance([tires, oil], position).maintenance.id).toBe(1);
    expect(nextMaintenance([], position)).toBeNull();
  });
});
