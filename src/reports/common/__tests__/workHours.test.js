import { describe, expect, it } from 'vitest';
import { weeklyTotals, workDays } from '../workHours';

// OPS-05: the working day runs from the first to the last ignition.
describe('work hours from ignition', () => {
  const trips = [
    { driverUniqueId: 'd1', startTime: '2026-11-08T07:00:00', endTime: '2026-11-08T08:00:00' },
    { driverUniqueId: 'd1', startTime: '2026-11-08T15:00:00', endTime: '2026-11-08T16:30:00' },
    { driverUniqueId: 'd1', startTime: '2026-11-09T07:30:00', endTime: '2026-11-09T09:00:00' },
    { driverUniqueId: null, startTime: '2026-11-09T07:30:00', endTime: '2026-11-09T09:00:00' },
  ];

  it('a day spans first to last ignition, with the driving inside it', () => {
    const days = workDays(trips);
    expect(days).toHaveLength(2);
    expect((days[0].end - days[0].start) / 3600000).toBe(9.5);
    expect(days[0].driving / 3600000).toBe(2.5);
  });

  it('adds up per driver', () => {
    expect(weeklyTotals(workDays(trips))).toEqual([
      { driver: 'd1', days: 2, spanMs: 11 * 3600000, drivingMs: 4 * 3600000 },
    ]);
  });
});

describe('a check-in starts the working day (OPS-05)', () => {
  it('moves the start earlier, and counts a day with no trips', () => {
    const local = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();
    const days = workDays(
      [{ driverUniqueId: 'd1', startTime: local(9, 8), endTime: local(9, 9) }],
      [
        { driver: 'd1', time: local(9, 7, 30) },
        { driver: 'd1', time: local(10, 7) },
      ],
    );
    expect(days).toHaveLength(2);
    expect(days[0].start).toBe(Date.parse(local(9, 7, 30)));
    expect(days[0].end).toBe(Date.parse(local(9, 9)));
    expect(days[1]).toMatchObject({ day: '2026-11-10', driving: 0 });
  });
});
