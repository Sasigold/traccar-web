import { describe, expect, it } from 'vitest';
import { vehiclesInside } from '../GeofenceInside';

describe('vehiclesInside (LIV-29)', () => {
  it('lists the vehicles whose latest position is in the geofence, by name', () => {
    const devices = {
      1: { id: 1, name: 'Van' },
      2: { id: 2, name: 'Bus' },
      3: { id: 3, name: 'Car' },
    };
    const positions = {
      1: { deviceId: 1, geofenceIds: [7] },
      2: { deviceId: 2, geofenceIds: [7, 8] },
      3: { deviceId: 3, geofenceIds: [8] },
    };
    expect(vehiclesInside(positions, devices, 7).map((device) => device.name)).toEqual([
      'Bus',
      'Van',
    ]);
    expect(vehiclesInside(positions, devices, 9)).toEqual([]);
  });
});

describe('dwell time in a geofence (LIV-29)', () => {
  it('counts from the latest entry into this geofence, and averages', async () => {
    const { averageDwell, dwellTimes } = await import('../GeofenceInside');
    const now = Date.parse('2026-11-10T12:00:00Z');
    const events = [
      { type: 'geofenceEnter', geofenceId: 7, deviceId: 1, eventTime: '2026-11-10T09:00:00Z' },
      { type: 'geofenceEnter', geofenceId: 7, deviceId: 1, eventTime: '2026-11-10T11:00:00Z' },
      { type: 'geofenceEnter', geofenceId: 8, deviceId: 2, eventTime: '2026-11-10T11:30:00Z' },
      { type: 'geofenceEnter', geofenceId: 7, deviceId: 2, eventTime: '2026-11-10T09:00:00Z' },
      { type: 'geofenceExit', geofenceId: 7, deviceId: 3, eventTime: '2026-11-10T11:59:00Z' },
    ];
    const dwells = dwellTimes(events, 7, [1, 2, 3], now);
    expect(dwells).toEqual({ 1: 3600000, 2: 3 * 3600000 });
    expect(averageDwell(dwells)).toBe(2 * 3600000);
    expect(averageDwell({})).toBeNull();
  });
});
