import { describe, expect, it } from 'vitest';
import { leaseAllowance, leaseRows } from '../leaseReport';

const attributes = {
  ownership: 'leased',
  leaseStartDate: '2026-01-01',
  leaseEndDate: '2027-01-01',
  leaseKmQuota: 36500,
  leaseStartKm: 1000,
};

describe('leaseAllowance', () => {
  it('gives the period its share of the quota', () => {
    // Ten days of a 365-day contract with 36,500 km: 1,000 km.
    const from = new Date(2026, 1, 1).toISOString();
    const to = new Date(2026, 1, 11).toISOString();
    expect(leaseAllowance(attributes, from, to)).toBe(1000 * 1000);
  });

  it('is nothing outside the contract or without a quota', () => {
    const from = new Date(2025, 1, 1).toISOString();
    const to = new Date(2025, 1, 11).toISOString();
    expect(leaseAllowance(attributes, from, to)).toBeNull();
    expect(leaseAllowance({ ...attributes, leaseKmQuota: '' }, from, to)).toBeNull();
  });
});

describe('leaseRows', () => {
  it('lists the leased vehicles with the period against the allowance', () => {
    const devices = [
      { id: 1, name: 'א', attributes },
      { id: 2, name: 'ב', attributes: { ownership: 'owned' } },
    ];
    const from = new Date(2026, 1, 1).toISOString();
    const to = new Date(2026, 1, 11).toISOString();
    const rows = leaseRows(
      devices,
      [{ deviceId: 1, distance: 1500 * 1000 }],
      () => 6000,
      from,
      to,
      new Date(2026, 6, 2),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deviceId: 1, allowanceShare: 150, used: 5000 * 1000 });
    expect(rows[0].quota).toBe(36500 * 1000);
  });
});
