import { describe, expect, it } from 'vitest';
import { cleanStreak, driverDays, leaderboard, weekOf } from '../leaderboard';

// SAF-05: the weekly leaderboard in fair groups, and streaks of clean days.
describe('the weekly leaderboard', () => {
  it('ranks within fair groups and skips drivers who barely drove', () => {
    const result = leaderboard([
      { driver: 'a', group: 'trucks', score: 90, km: 300 },
      { driver: 'b', group: 'trucks', score: 95, km: 200 },
      { driver: 'c', group: 'vans', score: 99, km: 5 },
    ]);
    expect(result).toEqual([
      {
        group: 'trucks',
        ranking: [
          { driver: 'b', group: 'trucks', score: 95, km: 200, rank: 1 },
          { driver: 'a', group: 'trucks', score: 90, km: 300, rank: 2 },
        ],
      },
    ]);
  });

  it('starts the week on Sunday', () => {
    const [from, to] = weekOf(new Date(2026, 10, 11, 10));
    expect(from.getDay()).toBe(0);
    expect(to - from).toBe(7 * 86400000);
  });

  it('counts clean driving days in a row, skipping days off', () => {
    const trips = [
      {
        deviceId: 1,
        driverUniqueId: 'd',
        startTime: '2026-11-08T08:00:00',
        endTime: '2026-11-08T09:00:00',
      },
      {
        deviceId: 1,
        driverUniqueId: 'd',
        startTime: '2026-11-09T08:00:00',
        endTime: '2026-11-09T09:00:00',
      },
      {
        deviceId: 1,
        driverUniqueId: 'd',
        startTime: '2026-11-11T08:00:00',
        endTime: '2026-11-11T09:00:00',
      },
    ];
    const events = [{ deviceId: 1, eventTime: '2026-11-08T08:30:00', type: 'alarm' }];
    const days = driverDays(
      trips,
      events,
      (trip) => trip.driverUniqueId,
      () => true,
    ).get('d');
    expect(days.map((d) => [d.day, d.drove, d.events])).toEqual([
      ['2026-11-08', true, 1],
      ['2026-11-09', true, 0],
      ['2026-11-11', true, 0],
    ]);
    expect(cleanStreak(days)).toBe(2);
  });
});
