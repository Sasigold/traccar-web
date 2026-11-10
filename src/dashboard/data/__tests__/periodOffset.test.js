import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { periodRange, shiftFilters } from '../periods';
import { periodLabel } from '../../components/periodLabel';

// REP-17: the arrows keep the preset and move on the calendar.
const now = dayjs('2026-11-09T10:00:00');
const t = (key) =>
  ({
    reportThisMonth: 'החודש',
    reportPreviousMonth: 'החודש הקודם',
    reportYesterday: 'אתמול',
    reportPreviousWeek: 'שבוע שעבר',
    reportToday: 'היום',
  })[key] || key;

describe('a preset moved by whole periods', () => {
  it('keeps October whole, 31st included', () => {
    const range = periodRange('thisMonth', now, { offset: -1 });
    expect(range.from.format('YYYY-MM-DD HH:mm')).toBe('2026-10-01 00:00');
    expect(range.to.format('YYYY-MM-DD HH:mm')).toBe('2026-10-31 23:59');
  });

  it('two months back from "last month" is August', () => {
    const range = periodRange('lastMonth', now, { offset: -1 });
    expect(range.from.format('YYYY-MM-DD')).toBe('2026-09-01');
  });

  it('a day across a daylight saving change still starts at midnight', () => {
    const range = periodRange('today', dayjs('2026-10-26T12:00:00'), { offset: -1 });
    expect(range.from.format('HH:mm')).toBe('00:00');
    expect(range.to.format('HH:mm')).toBe('23:59');
  });

  it('rolling presets move by their length in days', () => {
    const range = periodRange('last7', now, { offset: -1 });
    expect(range.from.format('YYYY-MM-DD')).toBe('2026-10-27');
    expect(range.to.format('YYYY-MM-DD')).toBe('2026-11-02');
  });

  it('the arrows keep the preset, and stop at the current period', () => {
    expect(shiftFilters({ period: 'thisMonth', offset: 0 }, -1)).toMatchObject({
      period: 'thisMonth',
      offset: -1,
    });
    expect(shiftFilters({ period: 'thisMonth', offset: 0 }, 1).offset).toBe(0);
  });

  it('is named by the calendar', () => {
    const label = (filters) => periodLabel(filters, periodRange(filters.period, now, filters), t);
    expect(label({ period: 'thisMonth', offset: -1 })).toBe('החודש הקודם');
    expect(label({ period: 'thisMonth', offset: -2 })).toMatch(/2026/);
    expect(label({ period: 'today', offset: -1 })).toBe('אתמול');
    expect(label({ period: 'thisWeek', offset: -1 })).toBe('שבוע שעבר');
    expect(label({ period: 'today', offset: 0 })).toBe('היום');
  });
});

describe('too much data says how much (REP-17)', () => {
  it('carries the vehicles, the days and the limit', async () => {
    const { checkSize } = await import('../reportFetch');
    try {
      checkSize('events', 120, 30);
      throw new Error('expected TooLargeError');
    } catch (error) {
      expect(error.name).toBe('TooLargeError');
      expect(error).toMatchObject({ devices: 120, days: 30 });
      expect(error.limit).toBeGreaterThan(0);
    }
  });
});
