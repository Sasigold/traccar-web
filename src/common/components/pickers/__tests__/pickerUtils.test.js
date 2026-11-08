import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import {
  DATE_TIME_FORMAT,
  displayRange,
  formatValue,
  minuteOptions,
  monthGrid,
  parseValue,
  roundToStep,
} from '../pickerUtils';

describe('pickerUtils', () => {
  it('parses date, date-time and time strings in local time', () => {
    expect(formatValue(parseValue('2026-03-09'), DATE_TIME_FORMAT)).toBe('2026-03-09T00:00');
    expect(formatValue(parseValue('2026-03-09T14:35'), DATE_TIME_FORMAT)).toBe('2026-03-09T14:35');
    const base = dayjs('2026-01-02T00:00');
    expect(formatValue(parseValue('08:05', base), DATE_TIME_FORMAT)).toBe('2026-01-02T08:05');
  });

  it('returns null for empty or malformed values', () => {
    expect(parseValue('')).toBeNull();
    expect(parseValue(null)).toBeNull();
    expect(parseValue('soon')).toBeNull();
  });

  it('builds a 6x7 month grid starting on the requested weekday', () => {
    const grid = monthGrid(dayjs('2026-11-15'), 0);
    expect(grid).toHaveLength(42);
    expect(grid[0].day()).toBe(0);
    expect(grid.some((day) => day.format('YYYY-MM-DD') === '2026-11-01')).toBe(true);
  });

  it('offers minutes in steps and keeps an off-step current value', () => {
    expect(minuteOptions(5)).toHaveLength(12);
    expect(minuteOptions(15)).toEqual([0, 15, 30, 45]);
    expect(minuteOptions(5, 3)).toContain(3);
    expect(minuteOptions(1)).toHaveLength(60);
  });

  it('rounds to the nearest step', () => {
    expect(roundToStep(dayjs('2026-01-01T10:03'), 5).format('HH:mm')).toBe('10:05');
    expect(roundToStep(dayjs('2026-01-01T10:58'), 5).format('HH:mm')).toBe('11:00');
    expect(roundToStep(dayjs('2026-01-01T10:58'), 1).format('HH:mm')).toBe('10:58');
  });
});

describe('displayRange', () => {
  it('drops the year when both ends are in the current year', () => {
    const year = dayjs().year();
    const start = dayjs(`${year}-03-09T00:00`);
    const end = dayjs(`${year}-03-15T23:59`);
    expect(displayRange(start, end, true)).toBe('03/09 00:00 – 03/15 23:59');
    expect(displayRange(dayjs('2020-03-09'), dayjs('2020-03-15'), false)).toBe(
      '03/09/2020 – 03/15/2020',
    );
    expect(displayRange(null, end, false)).toBe('');
  });
});
