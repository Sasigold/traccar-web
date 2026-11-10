import { describe, expect, it } from 'vitest';
import { filterVehicles } from '../VehicleSelect';

const devices = [
  { id: 1, name: 'Delivery Van', attributes: { plateNumber: '1234567' } },
  { id: 2, name: 'Service Van', attributes: { plateNumber: '12-345-68' } },
  { id: 3, name: 'משאית', attributes: {} },
];

describe('the vehicle picker search (ADM-29)', () => {
  it('finds by name, case-insensitive, Hebrew too', () => {
    expect(filterVehicles(devices, 'van').map((d) => d.id)).toEqual([1, 2]);
    expect(filterVehicles(devices, 'משא').map((d) => d.id)).toEqual([3]);
  });

  it('finds by plate with or without dashes', () => {
    expect(filterVehicles(devices, '12-345-67').map((d) => d.id)).toEqual([1]);
    expect(filterVehicles(devices, '1234568').map((d) => d.id)).toEqual([2]);
    expect(filterVehicles(devices, '345').map((d) => d.id)).toEqual([1, 2]);
  });

  it('shows all for an empty query', () => {
    expect(filterVehicles(devices, '  ')).toHaveLength(3);
  });
});
