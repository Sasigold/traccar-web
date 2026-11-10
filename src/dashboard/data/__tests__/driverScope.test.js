import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { driverDeviceIds } from '../scope';

describe("a driver's vehicles in the period (REP-05)", () => {
  const range = { from: dayjs('2026-11-01T00:00:00Z'), to: dayjs('2026-11-08T00:00:00Z') };

  it('keeps the vehicles whose assignment overlaps the period, open ones included', () => {
    const ids = driverDeviceIds(
      [
        { traccarDeviceId: 1, start: '2026-10-01T00:00:00Z', end: '2026-11-03T00:00:00Z' },
        { traccarDeviceId: 2, start: '2026-11-03T00:00:00Z', end: null },
        { traccarDeviceId: 3, start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z' },
        { traccarDeviceId: 4, start: '2026-11-09T00:00:00Z', end: null },
        { traccarDeviceId: null, start: '2026-11-02T00:00:00Z', end: null },
      ],
      range,
    );
    expect([...ids].sort()).toEqual([1, 2]);
  });

  it('is empty without assignments', () => {
    expect(driverDeviceIds(undefined, range).size).toBe(0);
  });
});
