import { describe, expect, it } from 'vitest';
import { isExceptionJob, onTime, onTimeByCustomer } from '../dispatchStats';

const now = new Date('2026-11-10T12:00:00Z');

describe('dispatch exceptions and on-time (OPS-11)', () => {
  it('flags late open jobs and failed ones only', () => {
    expect(isExceptionJob({ status: 'failed' }, now)).toBe(true);
    expect(isExceptionJob({ status: 'en_route', window_end: '2026-11-10T11:00:00Z' }, now)).toBe(
      true,
    );
    expect(isExceptionJob({ status: 'en_route', window_end: '2026-11-10T13:00:00Z' }, now)).toBe(
      false,
    );
    expect(isExceptionJob({ status: 'done', window_end: '2026-11-10T11:00:00Z' }, now)).toBe(false);
  });

  it('measures arrival against the window, or the planned time', () => {
    expect(onTime({ window_end: '2026-11-10T11:00:00Z', arrived_at: '2026-11-10T10:59:00Z' })).toBe(
      true,
    );
    expect(
      onTime({ scheduled_at: '2026-11-10T09:00:00Z', completed_at: '2026-11-10T09:30:00Z' }),
    ).toBe(false);
    expect(onTime({ completed_at: '2026-11-10T09:30:00Z' })).toBeNull();
  });

  it('sums per customer with the on-time share', () => {
    const rows = onTimeByCustomer([
      {
        status: 'done',
        customer_name: 'Shufersal',
        window_end: '2026-11-10T10:00:00Z',
        arrived_at: '2026-11-10T09:50:00Z',
      },
      {
        status: 'done',
        customer_name: 'Shufersal',
        window_end: '2026-11-10T10:00:00Z',
        arrived_at: '2026-11-10T10:20:00Z',
      },
      { status: 'failed', customer_name: 'Shufersal' },
      { status: 'done', pois: { name: 'Branch 4' } },
      { status: 'en_route', customer_name: 'Shufersal' },
    ]);
    expect(rows[0]).toEqual({
      customer: 'Shufersal',
      done: 2,
      failed: 1,
      measured: 2,
      onTime: 1,
      share: 0.5,
    });
    expect(rows[1]).toMatchObject({ customer: 'Branch 4', done: 1, share: null });
  });
});
