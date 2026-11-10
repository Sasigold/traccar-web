import { describe, expect, it } from 'vitest';
import { plateOf, vehicleName, vehicleTitle } from '../vehicle';

// REP-12: a vehicle in a report, including one deleted since.
const devices = {
  1: { id: 1, name: 'משאית 12', attributes: { plateNumber: '1234567' } },
  2: { id: 2, name: 'רכב', attributes: {} },
};

describe('a vehicle in a report', () => {
  it('has its name and its formatted plate', () => {
    expect(vehicleName(devices, 1)).toBe('משאית 12');
    expect(plateOf(devices[1])).toMatch(/12.?345.?67/);
    expect(vehicleTitle(devices, 1)).toMatch(/^משאית 12 · 12.?345.?67$/);
  });

  it('without a plate is just its name', () => {
    expect(vehicleTitle(devices, 2)).toBe('רכב');
  });

  it('deleted since is "#id", not a crash', () => {
    expect(vehicleName(devices, 9)).toBe('#9');
    expect(vehicleTitle(devices, 9)).toBe('#9');
    expect(plateOf(undefined)).toBe('');
  });
});
