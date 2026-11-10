import { describe, expect, it } from 'vitest';
import { nearbyVehicles } from '../dispatch';

// LIV-21: "who is closest?" for a point on the map.
const point = { latitude: 32.08, longitude: 34.78 };
const devices = {
  1: { id: 1, name: 'קרוב' },
  2: { id: 2, name: 'רחוק' },
  3: { id: 3, name: 'מושבת', disabled: true },
  4: { id: 4, name: 'בלי מיקום' },
};
const positions = {
  1: { deviceId: 1, latitude: 32.09, longitude: 34.79, speed: 0 },
  2: { deviceId: 2, latitude: 32.5, longitude: 35.0, speed: 0 },
  3: { deviceId: 3, latitude: 32.081, longitude: 34.781, speed: 0 },
  4: { deviceId: 4, latitude: null, longitude: null },
  9: { deviceId: 9, latitude: 32.08, longitude: 34.78 },
};

describe('nearby vehicles', () => {
  it('sorts by distance, with an ETA, leaving out disabled and unknown vehicles', () => {
    const result = nearbyVehicles(positions, devices, point);
    expect(result.map((row) => row.device.name)).toEqual(['קרוב', 'רחוק']);
    expect(result[0].km).toBeLessThan(2);
    expect(result[0].eta.minutes).toBeGreaterThan(0);
    expect(result[1].km).toBeGreaterThan(40);
  });

  it('keeps only the closest few', () => {
    expect(nearbyVehicles(positions, devices, point, 1)).toHaveLength(1);
    expect(nearbyVehicles({}, devices, point)).toEqual([]);
  });
});
