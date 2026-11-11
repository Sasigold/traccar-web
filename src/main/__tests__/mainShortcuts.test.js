import { describe, expect, it } from 'vitest';
import { nextVehicle } from '../MainShortcuts';

const devices = [{ id: 4 }, { id: 2 }, { id: 9 }];

describe('next and previous vehicle (LIV-15)', () => {
  it('moves in the list order and wraps', () => {
    expect(nextVehicle(devices, 4, 1)).toBe(2);
    expect(nextVehicle(devices, 9, 1)).toBe(4);
    expect(nextVehicle(devices, 4, -1)).toBe(9);
  });

  it('starts at an end when nothing is selected', () => {
    expect(nextVehicle(devices, null, 1)).toBe(4);
    expect(nextVehicle(devices, null, -1)).toBe(9);
    expect(nextVehicle([], null, 1)).toBeNull();
  });
});
