import { describe, expect, it } from 'vitest';
import { insertGaps, lttb, niceAxis, seriesRows, spansDays } from '../chartSeries';

// REP-15: honest charts.
describe('the value axis', () => {
  it('starts at zero with round ticks (no 30.25 or -5.04 for a speed)', () => {
    expect(niceAxis([3.96, 12.96, 21.96, 30.25])).toEqual({
      domain: [0, 40],
      ticks: [0, 10, 20, 30, 40],
    });
  });

  it('goes below zero only for values that do', () => {
    expect(niceAxis([-12, 30]).domain).toEqual([-20, 40]);
    expect(niceAxis([]).domain).toEqual([0, 1]);
  });
});

describe('gaps', () => {
  it('break the line where the vehicle reported nothing', () => {
    const minute = 60000;
    const rows = [0, 1, 2, 3, 60, 61].map((m) => ({ t: m * minute, v: m }));
    const result = insertGaps(rows, 't', ['v']);
    expect(result).toHaveLength(7);
    expect(result[4]).toMatchObject({ v: null, gap: true });
  });
});

describe('thinning', () => {
  it('keeps the first, the last and the peaks', () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({ t: i, v: i === 5000 ? 999 : i % 7 }));
    const result = lttb(rows, 2000, 't', 'v');
    expect(result).toHaveLength(2000);
    expect(result[0]).toBe(rows[0]);
    expect(result.at(-1)).toBe(rows.at(-1));
    expect(result.some((row) => row.v === 999)).toBe(true);
  });

  it('builds a series from string values and skips missing ones', () => {
    const items = [
      { id: 1, t: 0, speed: '10.50' },
      { id: 2, t: 1000, speed: null },
      { id: 3, t: 2000, speed: '20' },
    ];
    expect(seriesRows(items, 't', 'speed')).toEqual([
      { id: 1, t: 0, speed: 10.5 },
      { id: 3, t: 2000, speed: 20 },
    ]);
    expect(spansDays([{ t: 0 }, { t: 25 * 3600000 }], 't')).toBe(true);
  });
});
