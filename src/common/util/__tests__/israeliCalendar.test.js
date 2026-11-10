import { describe, expect, it } from 'vitest';
import { israeliDate, isRestTime, restDayOf, restPeriodAt, sunsetOf } from '../israeliCalendar';

const at = (iso) => Date.parse(iso);
const minutesOff = (a, b) => Math.abs(a - b) / 60000;

describe('the Israeli calendar (ISR-09)', () => {
  it('knows sunset in Tel Aviv within a few minutes', () => {
    // 21.6.2026 about 19:50 IDT (16:50 UTC); 21.12.2026 about 16:39 IST (14:39 UTC).
    expect(
      minutesOff(sunsetOf({ year: 2026, month: 6, day: 21 }), at('2026-06-21T16:50:00Z')),
    ).toBeLessThan(5);
    expect(
      minutesOff(sunsetOf({ year: 2026, month: 12, day: 21 }), at('2026-12-21T14:39:00Z')),
    ).toBeLessThan(5);
  });

  it('names Shabbat and the holidays', () => {
    expect(restDayOf(israeliDate(at('2026-11-14T10:00:00Z')))).toBe('shabbat');
    expect(restDayOf(israeliDate(at('2026-09-12T10:00:00Z')))).toBe('roshHashana');
    expect(restDayOf(israeliDate(at('2026-09-21T10:00:00Z')))).toBe('yomKippur');
    expect(restDayOf(israeliDate(at('2027-04-22T10:00:00Z')))).toBe('pesach');
    expect(restDayOf(israeliDate(at('2026-11-10T10:00:00Z')))).toBeNull();
  });

  it('moves Independence Day off Shabbat', () => {
    // 5 Iyar 5786 is on Wednesday 22.4.2026.
    expect(restDayOf(israeliDate(at('2026-04-22T10:00:00Z')))).toBe('independenceDay');
  });

  it('runs from candle lighting on the eve to nightfall on the day', () => {
    // Friday 13.11.2026: sunset about 16:45 IST (14:45 UTC).
    expect(isRestTime(at('2026-11-13T12:00:00Z'))).toBe(false);
    expect(isRestTime(at('2026-11-13T15:00:00Z'))).toBe(true);
    expect(isRestTime(at('2026-11-14T13:00:00Z'))).toBe(true);
    expect(isRestTime(at('2026-11-14T16:30:00Z'))).toBe(false);
    expect(restPeriodAt(at('2026-11-13T15:00:00Z')).kind).toBe('shabbat');
  });
});
