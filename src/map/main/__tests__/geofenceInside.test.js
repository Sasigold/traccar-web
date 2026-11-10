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
