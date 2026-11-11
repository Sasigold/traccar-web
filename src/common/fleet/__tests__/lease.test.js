import { describe, expect, it } from 'vitest';
import { leaseForecast } from '../lease';

const lease = {
  leaseStartDate: '2026-01-01',
  leaseEndDate: '2028-01-01',
  leaseStartKm: 10000,
  leaseKmQuota: 60000,
  leaseExcessRate: 0.5,
};

describe('leaseForecast', () => {
  it('projects the pace to the end of the contract', () => {
    // A quarter of the way, 20,000 km driven: 80,000 at this pace, 20,000 over.
    const result = leaseForecast(lease, 30000, new Date(2026, 6, 2));
    expect(result.used).toBe(20000);
    expect(result.projected).toBeGreaterThan(79000);
    expect(result.projected).toBeLessThan(81000);
    expect(result.excessKm).toBe(result.projected - 60000);
    expect(result.excessCost).toBe(Math.round(result.excessKm * 0.5));
  });

  it('stays quiet within the quota', () => {
    const result = leaseForecast(lease, 20000, new Date(2027, 0, 1));
    expect(result.projected).toBe(20000);
    expect(result.excessKm).toBe(0);
    expect(result.excessCost).toBeNull();
    expect(result.expected).toBe(Math.round((60000 * 365) / 730));
  });

  it('does not guess a pace in the first two weeks', () => {
    const result = leaseForecast(lease, 10500, new Date(2026, 0, 5));
    expect(result.projected).toBeNull();
    expect(result.excessKm).toBe(0);
  });

  it('needs dates, a quota and an odometer', () => {
    expect(leaseForecast({ ...lease, leaseKmQuota: '' }, 30000)).toBeNull();
    expect(leaseForecast({ ...lease, leaseEndDate: '' }, 30000)).toBeNull();
    expect(leaseForecast(lease, null)).toBeNull();
  });
});
