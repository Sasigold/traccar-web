import { describe, expect, it } from 'vitest';
import { emissionsByMonth, emissionsByVehicle } from '../emissions';

const devices = [
  { id: 1, name: 'Diesel truck' },
  { id: 2, name: 'Petrol car' },
  { id: 3, name: 'EV' },
  { id: 4, name: 'Parked' },
];
const summary = [
  { deviceId: 1, distance: 100000 },
  { deviceId: 2, distance: 50000 },
  { deviceId: 3, distance: 20000 },
];
const fuelTypes = { 1: 'diesel', 2: 'petrol', 3: 'electric' };

describe('CO2 per vehicle (OPS-10)', () => {
  it('uses liters when there are any, else kilometers by fuel type', () => {
    const fuel = [
      { deviceId: 1, liters: 30, fuel_type: 'סולר', occurred_at: '2026-10-02' },
      { deviceId: 1, liters: 10, fuel_type: null, occurred_at: '2026-11-01' },
    ];
    const [truck, car, ev, parked] = emissionsByVehicle(devices, summary, fuel, fuelTypes);
    expect(truck.method).toBe('liters');
    expect(truck.co2).toBeCloseTo(40 * 2.66);
    expect(truck.perKm).toBeCloseTo((40 * 2.66 * 1000) / 100);
    expect(car.method).toBe('distance');
    expect(car.co2).toBeCloseTo(50 * 0.164);
    expect(ev.co2).toBe(0);
    expect(parked).toMatchObject({ co2: 0, method: null, perKm: null });
  });

  it('falls back to petrol when the fuel type is unknown, and says so', () => {
    const [row] = emissionsByVehicle(
      [{ id: 9, name: 'x' }],
      [{ deviceId: 9, distance: 10000 }],
      [],
    );
    expect(row.method).toBe('distanceDefault');
    expect(row.co2).toBeCloseTo(10 * 0.164);
  });

  it('reads gasoline as petrol, not as gas', () => {
    const fuel = [{ deviceId: 2, liters: 10, fuel_type: 'gasoline', occurred_at: '2026-10-02' }];
    const [, car] = emissionsByVehicle(devices, summary, fuel, fuelTypes);
    expect(car.co2).toBeCloseTo(10 * 2.31);
    expect(emissionsByMonth(fuel, fuelTypes)[0].co2).toBeCloseTo(23.1);
  });

  it('sums the fuel by month', () => {
    const fuel = [
      { deviceId: 2, liters: 10, fuel_type: 'בנזין 95', occurred_at: '2026-10-05T08:00:00Z' },
      { deviceId: 1, liters: 10, fuel_type: 'diesel', occurred_at: '2026-10-20T08:00:00Z' },
      { deviceId: 1, liters: 5, occurred_at: '2026-11-02T08:00:00Z' },
    ];
    expect(emissionsByMonth(fuel, fuelTypes)).toEqual([
      { month: '2026-10', co2: expect.closeTo(23.1 + 26.6) },
      { month: '2026-11', co2: expect.closeTo(13.3) },
    ]);
  });
});
