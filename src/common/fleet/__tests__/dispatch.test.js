import { describe, expect, it } from 'vitest';
import { isLateJob, jobMarkerColor, scheduleByDriver } from '../dispatch';

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

describe('the dispatch map and schedule (ADM-20)', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it('colors a job by where it stands', () => {
    expect(jobMarkerColor({ status: 'done' }, now)).toBe('success');
    expect(jobMarkerColor({ status: 'failed' }, now)).toBe('error');
    expect(jobMarkerColor({ status: 'assigned', scheduled_at: '2026-11-10T08:00:00Z' }, now)).toBe(
      'error',
    );
    expect(jobMarkerColor({ status: 'en_route', scheduled_at: '2026-11-10T14:00:00Z' }, now)).toBe(
      'info',
    );
    expect(jobMarkerColor({ status: 'planned', scheduled_at: '2026-11-10T14:00:00Z' }, now)).toBe(
      'neutral',
    );
  });

  it('groups the day by driver, in time order, with no driver last', () => {
    const groups = scheduleByDriver([
      {
        id: 1,
        driver_id: 'd2',
        drivers: { full_name: 'יוסי' },
        scheduled_at: '2026-11-10T10:00:00Z',
      },
      { id: 2, driver_id: null, scheduled_at: '2026-11-10T09:00:00Z' },
      {
        id: 3,
        driver_id: 'd1',
        drivers: { full_name: 'דנה' },
        scheduled_at: '2026-11-10T11:00:00Z',
      },
      {
        id: 4,
        driver_id: 'd2',
        drivers: { full_name: 'יוסי' },
        scheduled_at: '2026-11-10T08:00:00Z',
      },
    ]);
    expect(groups.map((group) => group.name)).toEqual(['דנה', 'יוסי', null]);
    expect(groups[1].jobs.map((job) => job.id)).toEqual([4, 1]);
  });
});
