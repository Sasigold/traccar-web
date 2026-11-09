import { describe, expect, it } from 'vitest';
import { totalsOf } from '../components/ReportTableParts';

describe('report totals', () => {
  const items = [
    { distance: 10, duration: 600, maxSpeed: 50, averageSpeed: 40 },
    { distance: 30, duration: 1800, maxSpeed: 80, averageSpeed: 60 },
    { distance: null, duration: 0, maxSpeed: undefined, averageSpeed: 10 },
  ];

  it('sums, takes the top, and weights averages', () => {
    const totals = totalsOf(items, {
      distance: 'sum',
      duration: 'sum',
      maxSpeed: 'max',
      averageSpeed: 'avg:duration',
    });
    expect(totals.distance).toBe(40);
    expect(totals.duration).toBe(2400);
    expect(totals.maxSpeed).toBe(80);
    // (40 × 600 + 60 × 1800 + 10 × 0) / 2400
    expect(totals.averageSpeed).toBe(55);
  });

  it('leaves a column without numbers empty', () => {
    expect(totalsOf([{ spentFuel: null }], { spentFuel: 'sum' }).spentFuel).toBeNull();
  });
});
