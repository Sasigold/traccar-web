import { describe, expect, it } from 'vitest';
import { tripTiming } from '../tripTiming';

describe('when a trip started (REP-14)', () => {
  it('marks Shabbat, the evening after hours, and a working morning as neither', () => {
    // Saturday 7 Nov 2026, noon in Israel.
    expect(tripTiming({ startTime: '2026-11-07T10:00:00Z' })).toEqual({
      restDay: 'shabbat',
      outsideHours: false,
    });
    // Monday 9 Nov 2026, 22:00 in Israel.
    expect(tripTiming({ startTime: '2026-11-09T20:00:00Z' })).toEqual({
      restDay: null,
      outsideHours: true,
    });
    // Monday 9 Nov 2026, 09:00 in Israel.
    expect(tripTiming({ startTime: '2026-11-09T07:00:00Z' })).toEqual({
      restDay: null,
      outsideHours: false,
    });
  });

  it('follows the organization hours', () => {
    const policy = { work_days: [0, 1, 2, 3, 4], work_start: '06:00', work_end: '23:00' };
    expect(tripTiming({ startTime: '2026-11-09T20:00:00Z' }, policy).outsideHours).toBe(false);
  });
});
