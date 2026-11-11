import { describe, expect, it } from 'vitest';
import {
  byGeofence,
  filterStops,
  litersPer100,
  overspeedText,
  visitDuration,
} from '../reportRules';

// REP-14: rules for single reports.
describe('stops', () => {
  const rows = [
    { duration: 2 * 60000, engineHours: 0 },
    { duration: 20 * 60000, engineHours: 0 },
    { duration: 40 * 60000, engineHours: 10 * 60000 },
  ];

  it('of at least a duration, and only idling ones', () => {
    expect(filterStops(rows, { minMinutes: 15 })).toHaveLength(2);
    expect(filterStops(rows, { idleOnly: true })).toEqual([rows[2]]);
    expect(filterStops(rows)).toHaveLength(3);
  });
});

describe('trips', () => {
  it('liters per 100 km', () => {
    expect(litersPer100(12, 100000)).toBe(12);
    expect(litersPer100(0, 100000)).toBeNull();
    expect(litersPer100(5, 0)).toBeNull();
  });
});

describe('events', () => {
  const kmh = (knots) => `${Math.round(knots * 1.852)} קמ"ש`;
  it('the speed with its limit', () => {
    expect(overspeedText({ speed: 60.48, speedLimit: 48.6 }, kmh, 'מותר {0}')).toBe(
      '112 קמ"ש (מותר 90 קמ"ש)',
    );
    expect(overspeedText({ speed: 60.48 }, kmh, 'מותר {0}')).toBe('112 קמ"ש');
    expect(overspeedText({}, kmh, 'מותר {0}')).toBeNull();
  });
});

describe('geofence visits', () => {
  const now = Date.parse('2026-11-09T12:00:00Z');
  it('a visit without an exit is still inside, counted until now', () => {
    expect(visitDuration({ startTime: '2026-11-09T11:00:00Z' }, now)).toEqual({
      open: true,
      duration: 3600000,
    });
    expect(
      visitDuration({ startTime: '2026-11-09T10:00:00Z', endTime: '2026-11-09T10:30:00Z' }, now),
    ).toEqual({ open: false, duration: 1800000 });
  });
});

describe('speeding against the road limit (SAF-06)', () => {
  it('grades the excess in km/h', async () => {
    const { speedingBand, overspeedBand } = await import('../reportRules');
    expect(speedingBand(95, 90)).toBe('minor');
    expect(speedingBand(105, 90)).toBe('medium');
    expect(speedingBand(112, 90)).toBe('severe');
    expect(speedingBand(80, 90)).toBeNull();
    expect(speedingBand(80, null)).toBeNull();
    expect(overspeedBand({ speed: 60.48, speedLimit: 48.6 })).toBe('severe');
    expect(overspeedBand({ speed: 60.48 })).toBeNull();
  });
});

describe('the geofences report by geofence (REP-14)', () => {
  it('adds up visits, vehicles and time, with the open visits up to now', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    const rows = byGeofence(
      [
        {
          geofenceId: 1,
          deviceId: 1,
          startTime: '2026-11-10T08:00:00Z',
          endTime: '2026-11-10T09:00:00Z',
        },
        {
          geofenceId: 1,
          deviceId: 2,
          startTime: '2026-11-10T10:00:00Z',
          endTime: '2026-11-10T11:00:00Z',
        },
        { geofenceId: 1, deviceId: 1, startTime: '2026-11-10T11:00:00Z' },
        {
          geofenceId: 2,
          deviceId: 3,
          startTime: '2026-11-10T08:00:00Z',
          endTime: '2026-11-10T08:30:00Z',
        },
      ],
      now,
    );
    expect(rows[0]).toMatchObject({ geofenceId: 1, visits: 3, vehicles: 2, inside: 1 });
    expect(rows[0].total).toBe(3 * 3600000);
    expect(rows[0].average).toBe(3600000);
    expect(rows[1]).toMatchObject({ geofenceId: 2, visits: 1, vehicles: 1, inside: 0 });
  });
});
