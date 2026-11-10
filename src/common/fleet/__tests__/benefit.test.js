import { describe, expect, it } from 'vitest';
import { monthlyBenefit, poolBenefit, poolNights, propulsionOf } from '../benefit';

// ISR-05: the monthly taxable benefit of a company car (2026 values, to confirm yearly).
describe('the taxable benefit of a company car', () => {
  it('is 2.48% of the list price, capped, less the electric or hybrid reduction', () => {
    expect(monthlyBenefit(200000)).toBe(4960);
    expect(monthlyBenefit(900000)).toBe(Math.round(596860 * 0.0248));
    expect(monthlyBenefit(200000, 'electric')).toBe(4960 - 1350);
    expect(monthlyBenefit(200000, propulsionOf('hybrid'))).toBe(4960 - 560);
    expect(monthlyBenefit('')).toBeNull();
  });

  it('for a pool car, only the nights it went home', () => {
    expect(poolBenefit(4960, 10, 31)).toBe(1600);
    expect(poolBenefit(null, 10, 31)).toBeNull();
  });
});

describe('the pool night log (ISR-05)', () => {
  it('counts the nights a booking held the car at 2 am, in the month', () => {
    const local = (day, hour) => new Date(2026, 10, day, hour).toISOString();
    const { days, log, totals } = poolNights(
      [
        // Taken on the 3rd at 16:00, back on the 5th at 08:00: two nights (4th, 5th at 02:00).
        {
          status: 'returned',
          requested_by: 'p1',
          vehicle_id: 'v1',
          starts_at: local(3, 16),
          ends_at: local(5, 8),
        },
        // A day trip: no night.
        {
          status: 'approved',
          requested_by: 'p1',
          vehicle_id: 'v1',
          starts_at: local(10, 8),
          ends_at: local(10, 18),
        },
        // Cancelled: not counted.
        {
          status: 'cancelled',
          requested_by: 'p2',
          vehicle_id: 'v1',
          starts_at: local(12, 16),
          ends_at: local(14, 8),
        },
      ],
      new Date(2026, 10, 15),
    );
    expect(days).toBe(30);
    expect(log.map((night) => night.date)).toEqual(['2026-11-04', '2026-11-05']);
    expect(totals).toEqual([{ personId: 'p1', vehicleId: 'v1', nights: 2 }]);
  });
});
