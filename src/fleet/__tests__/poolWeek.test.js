import { describe, expect, it } from 'vitest';
import { bookingsOnDay, weekDays } from '../poolWeek';

describe('the pool week (OPS-06)', () => {
  it('lists seven days from the start', () => {
    const days = weekDays('2026-11-08T10:00:00');
    expect(days).toHaveLength(7);
    expect(days[0].format('YYYY-MM-DD')).toBe('2026-11-08');
    expect(days[6].format('YYYY-MM-DD')).toBe('2026-11-14');
  });

  it('puts a booking on every day it touches, without cancelled or rejected ones', () => {
    const bookings = [
      {
        id: 'a',
        vehicle_id: 'v1',
        status: 'approved',
        starts_at: '2026-11-09T08:00:00',
        ends_at: '2026-11-10T12:00:00',
      },
      {
        id: 'b',
        vehicle_id: 'v1',
        status: 'cancelled',
        starts_at: '2026-11-09T08:00:00',
        ends_at: '2026-11-09T12:00:00',
      },
      {
        id: 'c',
        vehicle_id: 'v2',
        status: 'requested',
        starts_at: '2026-11-09T08:00:00',
        ends_at: '2026-11-09T12:00:00',
      },
    ];
    expect(bookingsOnDay(bookings, 'v1', '2026-11-09').map((b) => b.id)).toEqual(['a']);
    expect(bookingsOnDay(bookings, 'v1', '2026-11-10').map((b) => b.id)).toEqual(['a']);
    expect(bookingsOnDay(bookings, 'v1', '2026-11-11')).toEqual([]);
  });
});
