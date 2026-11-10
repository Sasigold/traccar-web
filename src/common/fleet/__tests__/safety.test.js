import { describe, expect, it } from 'vitest';
import {
  drivingHours,
  drivingIntervals,
  eventCategory,
  safetyScore,
  scoreDrivers,
} from '../safety';

const at = (h, m = 0, day = 6) => new Date(2026, 10, day, h, m).toISOString();

describe('driver score', () => {
  it('maps Traccar events to categories', () => {
    expect(eventCategory({ type: 'deviceOverspeed' })).toBe('overspeed');
    expect(eventCategory({ type: 'alarm', attributes: { alarm: 'hardBraking' } })).toBe(
      'hardBraking',
    );
    expect(eventCategory({ type: 'alarm', attributes: { alarm: 'sos' } })).toBeNull();
    expect(eventCategory({ type: 'ignitionOn' })).toBeNull();
  });

  it('weights events per 100 km and stays within 0-100', () => {
    expect(safetyScore({}, 200)).toBe(100);
    expect(safetyScore({ overspeed: 1, hardBraking: 2 }, 200)).toBe(80);
    expect(safetyScore({ accident: 10 }, 50)).toBe(0);
    expect(safetyScore({ overspeed: 1 }, 5)).toBeNull();
  });

  it('gives events to the driver of the trip they happened in', () => {
    const trips = [
      { deviceId: 1, driverUniqueId: 'A', startTime: at(8), endTime: at(10), distance: 100000 },
      { deviceId: 1, driverUniqueId: 'B', startTime: at(12), endTime: at(14), distance: 50000 },
      { deviceId: 2, startTime: at(8), endTime: at(9), distance: 30000 },
    ];
    const events = [
      { deviceId: 1, type: 'deviceOverspeed', eventTime: at(9) },
      { deviceId: 1, type: 'alarm', attributes: { alarm: 'hardBraking' }, eventTime: at(13) },
      { deviceId: 1, type: 'alarm', attributes: { alarm: 'hardBraking' }, eventTime: at(13, 30) },
      { deviceId: 2, type: 'deviceOverspeed', eventTime: at(8, 30) },
      { deviceId: 1, type: 'deviceOverspeed', eventTime: at(11) },
    ];
    const result = scoreDrivers(trips, events, {
      fallbackDriver: (deviceId) => (deviceId === 2 ? 'C' : null),
    });
    expect(result.map((row) => [row.driver, row.km, row.counts, row.score])).toEqual([
      ['C', 30, { overspeed: 1 }, 33],
      ['B', 50, { hardBraking: 2 }, 60],
      ['A', 100, { overspeed: 1 }, 80],
    ]);
  });
});

describe('driving hours', () => {
  it('merges trips separated by less than the break', () => {
    const intervals = drivingIntervals([
      { startTime: at(8), endTime: at(9) },
      { startTime: at(9, 10), endTime: at(10) },
      { startTime: at(11), endTime: at(12) },
    ]);
    expect(intervals.map((it) => [(it.end - it.start) / 60000, it.driving / 60000])).toEqual([
      [120, 110],
      [60, 60],
    ]);
  });

  it('flags continuous driving, short rest and long days', () => {
    const trips = [
      // 5 hours without a 30 minute break
      { startTime: at(6), endTime: at(8, 30) },
      { startTime: at(8, 40), endTime: at(11) },
      // then a long afternoon: 13 hours driving on the 6th in total
      { startTime: at(11, 40), endTime: at(15) },
      { startTime: at(15, 40), endTime: at(19) },
      { startTime: at(19, 40), endTime: at(23) },
      // back at 03:00 next day: only 4 hours rest
      { startTime: at(3, 0, 7), endTime: at(4, 0, 7) },
    ];
    const { daily, violations } = drivingHours(trips);
    expect(daily).toEqual([
      { day: '2026-11-06', minutes: 890 },
      { day: '2026-11-07', minutes: 60 },
    ]);
    expect(violations.map((v) => v.type).sort()).toEqual(['continuous', 'daily', 'rest']);
  });

  it('flags more than 68 hours in 7 days', () => {
    const trips = [];
    for (let day = 1; day <= 7; day += 1) {
      for (const [start, end] of [
        [6, 9],
        [9.75, 13],
        [13.75, 17],
        [17.75, 19.5],
      ]) {
        trips.push({
          startTime: new Date(2026, 10, day, Math.floor(start), (start % 1) * 60).toISOString(),
          endTime: new Date(2026, 10, day, Math.floor(end), (end % 1) * 60).toISOString(),
        });
      }
    }
    const { violations, totalMinutes } = drivingHours(trips);
    // 675 minutes a day: under the daily limit, 78.75 hours over 7 days.
    expect(totalMinutes).toBe(7 * 675);
    expect(violations.filter((v) => v.type === 'weekly').map((v) => v.day)).toEqual(['2026-11-07']);
  });
});

describe('regulation 168, the rest of it (ISR-07)', () => {
  const day = (d, h) => new Date(2026, 10, d, h).toISOString();
  // Ten days in a row, 08:00-16:00 with short breaks: never 25 hours off.
  const everyDay = Array.from({ length: 10 }, (_, i) => ({
    startTime: day(1 + i, 8),
    endTime: day(1 + i, 16),
  }));

  it('needs 25 hours of continuous rest in every 8 days', async () => {
    const { weeklyRestViolations } = await import('../safety');
    const found = weeklyRestViolations(everyDay, undefined, Date.parse(day(11, 0)));
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].type).toBe('weeklyRest');
    const withDayOff = everyDay.filter((_, i) => i !== 4 && i !== 5);
    expect(weeklyRestViolations(withDayOff, undefined, Date.parse(day(11, 0)))).toEqual([]);
  });

  it('warns before the daily limit', async () => {
    const { drivingAllowance } = await import('../safety');
    const allowance = drivingAllowance(
      [
        {
          startTime: new Date(2026, 10, 9, 6).toISOString(),
          endTime: new Date(2026, 10, 9, 17, 40).toISOString(),
        },
      ],
      undefined,
      new Date(2026, 10, 9, 18).getTime(),
    );
    expect(allowance.level).toBe('near');
    expect(allowance.leftMinutes).toBeLessThanOrEqual(30);
  });
});
