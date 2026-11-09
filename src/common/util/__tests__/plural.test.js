import { describe, expect, it } from 'vitest';
import { formatDays } from '../plural';

const he = { sharedDayOne: 'יום אחד', sharedDayTwo: 'יומיים', sharedDaysCount: '{0} ימים' };
const t = (key) => he[key];

describe('formatDays', () => {
  it('uses the Hebrew forms for one and two days', () => {
    expect(formatDays(1, t)).toBe('יום אחד');
    expect(formatDays(2, t)).toBe('יומיים');
    expect(formatDays(3, t)).toBe('3 ימים');
    expect(formatDays(-1, t)).toBe('יום אחד');
    expect(formatDays(0, t)).toBe('0 ימים');
  });
});
