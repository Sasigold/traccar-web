import { describe, expect, it } from 'vitest';
import { jobOnTime, jobsByDriver } from '../jobCompliance';

const job = (status, extra = {}) => ({ status, ...extra });

describe('jobOnTime', () => {
  it('compares the arrival with the end of the window', () => {
    const window_end = '2026-11-11T10:00:00Z';
    expect(jobOnTime(job('done', { window_end, arrived_at: '2026-11-11T09:50:00Z' }))).toBe(true);
    expect(jobOnTime(job('done', { window_end, arrived_at: '2026-11-11T10:20:00Z' }))).toBe(false);
    expect(jobOnTime(job('done', { window_end, completed_at: '2026-11-11T10:20:00Z' }))).toBe(
      false,
    );
  });

  it('counts a job without a window as on time, and only done jobs', () => {
    expect(jobOnTime(job('done'))).toBe(true);
    expect(jobOnTime(job('failed'))).toBeNull();
    expect(jobOnTime(job('done', { window_end: '2026-11-11T10:00:00Z' }))).toBeNull();
  });
});

describe('jobsByDriver', () => {
  it('sums each driver and leaves cancelled jobs out', () => {
    const window_end = '2026-11-11T10:00:00Z';
    const dana = { driver_id: 'd1', drivers: { full_name: 'דנה', traccar_driver_id: 7 } };
    const rows = jobsByDriver(
      [
        job('done', { ...dana, window_end, arrived_at: '2026-11-11T09:00:00Z' }),
        job('done', { ...dana, window_end, arrived_at: '2026-11-11T11:00:00Z' }),
        job('failed', dana),
        job('cancelled', dana),
        job('planned'),
      ],
      'ללא נהג',
    );
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'דנה',
        traccarDriverId: 7,
        jobs: 3,
        done: 2,
        onTime: 1,
        late: 1,
        failed: 1,
        onTimeShare: 50,
      }),
      expect.objectContaining({ name: 'ללא נהג', jobs: 1, onTimeShare: null }),
    ]);
  });
});
