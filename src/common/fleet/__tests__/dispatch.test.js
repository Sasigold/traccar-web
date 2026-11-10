import { describe, expect, it } from 'vitest';
import { isLateJob } from '../dispatch';

describe('isLateJob (ADM-20)', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it('is late after the window, or the planned time without one', () => {
    expect(isLateJob({ status: 'en_route', window_end: '2026-11-10T11:00:00Z' }, now)).toBe(true);
    expect(isLateJob({ status: 'assigned', scheduled_at: '2026-11-10T11:30:00Z' }, now)).toBe(true);
    expect(isLateJob({ status: 'en_route', window_end: '2026-11-10T13:00:00Z' }, now)).toBe(false);
  });

  it('a closed job, or one that arrived, is not late', () => {
    expect(isLateJob({ status: 'done', window_end: '2026-11-10T11:00:00Z' }, now)).toBe(false);
    expect(isLateJob({ status: 'arrived', window_end: '2026-11-10T11:00:00Z' }, now)).toBe(false);
    expect(isLateJob({ status: 'planned' }, now)).toBe(false);
  });
});
