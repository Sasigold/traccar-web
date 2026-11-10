import { describe, expect, it } from 'vitest';
import { addToPick, positionsInBox } from '../areaSelect';

const positions = [
  { deviceId: 1, latitude: 32.08, longitude: 34.78 },
  { deviceId: 2, latitude: 32.1, longitude: 34.85 },
  { deviceId: 3, latitude: 31.25, longitude: 34.79 },
];

describe('picking by area (LIV-25)', () => {
  it('finds the vehicles inside the box, whichever way it was drawn', () => {
    expect(positionsInBox(positions, { lng: 34.9, lat: 32.2 }, { lng: 34.7, lat: 32.0 })).toEqual([
      1, 2,
    ]);
    expect(positionsInBox(positions, { lng: 34.7, lat: 31 }, { lng: 34.8, lat: 31.5 })).toEqual([
      3,
    ]);
  });

  it('adds to what was picked', () => {
    expect(addToPick([2, 5], [1, 2])).toEqual([2, 5, 1]);
    expect(addToPick(null, [1])).toEqual([1]);
  });
});
