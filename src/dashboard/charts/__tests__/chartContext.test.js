import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { againstTarget, compareRangeText, parseTarget } from '../chartContext';

describe('chart context (REP-18)', () => {
  it('names the earlier period a change is measured against', () => {
    expect(compareRangeText({ from: dayjs('2026-11-01'), to: dayjs('2026-11-07T23:59') })).toBe(
      '1.11–7.11',
    );
    expect(compareRangeText({ from: dayjs('2026-11-09'), to: dayjs('2026-11-09T12:00') })).toBe(
      '9.11',
    );
    expect(compareRangeText(null)).toBe('');
  });

  it('reads a target and measures against it', () => {
    expect(parseTarget('1,500')).toBe(1500);
    expect(parseTarget('')).toBeUndefined();
    expect(parseTarget('-3')).toBeUndefined();
    expect(againstTarget(750, 1500)).toBe(0.5);
    expect(againstTarget(750, undefined)).toBeNull();
  });
});
