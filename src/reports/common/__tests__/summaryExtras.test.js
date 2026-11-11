import { describe, expect, it } from 'vitest';
import {
  activeDaysByDevice,
  distancePerDay,
  drivingByDevice,
  fuelPer100,
  idlePercent,
} from '../summaryExtras';

describe('the summary extras (REP-14)', () => {
  const daily = [
    { deviceId: 1, startTime: '2026-11-01T06:00:00', distance: 12000 },
    { deviceId: 1, startTime: '2026-11-02T06:00:00', distance: 0 },
    { deviceId: 1, startTime: '2026-11-03T06:00:00', distance: 3000 },
    { deviceId: 2, startTime: '2026-11-01T06:00:00', distance: 5000 },
  ];

  it('counts the days a vehicle moved', () => {
    expect(activeDaysByDevice(daily)).toEqual(
      new Map([
        [1, 2],
        [2, 1],
      ]),
    );
  });

  it('gives litres per 100 km only with fuel and distance', () => {
    expect(fuelPer100(8, 100000)).toBe(8);
    expect(fuelPer100(0, 100000)).toBeNull();
    expect(fuelPer100(5, 0)).toBeNull();
  });

  it('works out idling from engine hours and driving time', () => {
    const driving = drivingByDevice([
      { deviceId: 1, duration: 3600000 },
      { deviceId: 1, duration: 1800000 },
    ]);
    expect(driving.get(1)).toBe(5400000);
    expect(idlePercent(7200000, driving.get(1))).toBe(25);
    expect(idlePercent(0, 1000)).toBeNull();
    expect(idlePercent(1000, 5000)).toBe(0);
  });

  it('adds the distance of every vehicle per day, empty days included', () => {
    const points = distancePerDay(daily, '2026-11-01T00:00:00', '2026-11-04T00:00:00');
    expect(points.map((point) => point.value)).toEqual([17000, 0, 3000]);
  });
});
