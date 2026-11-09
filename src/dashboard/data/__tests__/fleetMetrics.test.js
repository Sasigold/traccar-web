import { describe, expect, it } from 'vitest';
import { activeDaysPct, afterHours, co2Kg, privateTrip } from '../fleetMetrics';
import { reduceMeasure } from '../aggregate';

describe('fleet metrics', () => {
  it('turns fuel into CO2 by fuel type, and leaves unknown fuels out', () => {
    expect(co2Kg(100, 'petrol')).toBeCloseTo(231);
    expect(co2Kg(100, 'diesel')).toBeCloseTo(268);
    expect(co2Kg(100, 'electric')).toBe(0);
    expect(co2Kg(100, 'gas')).toBeNull();
    expect(co2Kg(null, 'diesel')).toBeNull();
  });

  it('knows which trips start after hours (Israel time)', () => {
    expect(afterHours(null, '2026-11-10T21:30:00+02:00')).toBe(true); // Tuesday night
    expect(afterHours(null, '2026-11-10T10:00:00+02:00')).toBe(false);
    expect(afterHours(null, '2026-11-14T10:00:00+02:00')).toBe(true); // Saturday
  });

  it('finds trips in private mode', () => {
    const periods = [
      {
        traccar_device_id: 1,
        started_at: '2026-11-10T17:00:00Z',
        ended_at: '2026-11-10T20:00:00Z',
      },
    ];
    expect(privateTrip(periods, { deviceId: 1, startTime: '2026-11-10T18:00:00Z' })).toBe(true);
    expect(privateTrip(periods, { deviceId: 2, startTime: '2026-11-10T18:00:00Z' })).toBe(false);
  });

  it('counts active vehicle-days', () => {
    const trips = [
      { deviceId: 1, startTime: '2026-11-01T08:00:00Z', distance: 5000 },
      { deviceId: 1, startTime: '2026-11-01T12:00:00Z', distance: 3000 },
      { deviceId: 2, startTime: '2026-11-02T08:00:00Z', distance: 1000 },
      { deviceId: 3, startTime: '2026-11-02T08:00:00Z', distance: 0 },
    ];
    expect(activeDaysPct(trips, 4, 2)).toBe(25); // 2 of 8 vehicle-days
    expect(activeDaysPct(trips, 0, 2)).toBeNull();
  });
});

describe('quotient measures', () => {
  it('divides the sums, not the average of ratios', () => {
    const rows = [
      { spentFuel: 10, distance: 100_000 }, // 10 L/100 km
      { spentFuel: 30, distance: 200_000 }, // 15 L/100 km
      { spentFuel: 0, distance: 50_000 }, // no fuel sensor: left out
    ];
    const measure = {
      agg: 'quotient',
      numerator: (row) => (row.spentFuel > 0 ? row.spentFuel : null),
      denominator: (row) => row.distance,
      scale: 100_000,
    };
    expect(reduceMeasure(rows, measure)).toBeCloseTo(13.333, 2);
    expect(reduceMeasure([], measure)).toBeNull();
  });

  it('passes the context to values and custom reductions', () => {
    const rows = [{ deviceId: 1, spentFuel: 10 }];
    const ctx = { fuelTypeOf: () => 'diesel' };
    const co2 = { agg: 'sum', value: (row, c) => co2Kg(row.spentFuel, c.fuelTypeOf(row.deviceId)) };
    expect(reduceMeasure(rows, co2, ctx)).toBeCloseTo(26.8);
    expect(
      reduceMeasure(
        rows,
        { agg: 'custom', reduce: (list, c) => list.length + c.extra },
        { extra: 2 },
      ),
    ).toBe(3);
  });
});
