import { describe, expect, it } from 'vitest';
import { createFleet } from '../fleet.js';
import { israeliDrivers } from '../israel.js';

// BRD-05: the Israeli demo fleet.
describe('the Israeli demo fleet', () => {
  const fleet = createFleet(Date.parse('2026-11-10T08:00:00Z'), { israeli: true });

  it('has Hebrew vehicle names and Israeli plates', () => {
    fleet.devices.forEach((device) => {
      expect(device.name).toMatch(/[֐-׿]/);
      expect(device.attributes.plateNumber).toMatch(/^\d{2,3}-\d{2,3}-\d{2,3}$/);
    });
  });

  it('drives in Israeli cities, with Hebrew addresses', () => {
    fleet.positions.forEach((position) => {
      expect(position.latitude).toBeGreaterThan(29.4);
      expect(position.latitude).toBeLessThan(33.4);
      expect(position.longitude).toBeGreaterThan(34.2);
      expect(position.longitude).toBeLessThan(35.9);
      expect(position.address).toMatch(/[֐-׿]/);
    });
    const cities = new Set(fleet.positions.map((position) => position.address.split(', ').at(-1)));
    expect(cities.size).toBeGreaterThanOrEqual(4);
  });

  it('keeps some validity dates expired', () => {
    const today = '2026-11-10';
    const expired = fleet.devices.filter((device) =>
      Object.entries(device.attributes).some(
        ([key, value]) => /Expiry$/.test(key) && value < today,
      ),
    );
    expect(expired.length).toBeGreaterThan(0);
  });

  it('names the drivers in Hebrew', () => {
    const drivers = israeliDrivers([
      { id: 2, name: 'Yossi Cohen' },
      { id: 9, name: 'Other' },
    ]);
    expect(drivers.map((driver) => driver.name)).toEqual(['יוסי כהן', 'Other']);
  });

  it('leaves the default fleet as the tests know it', () => {
    expect(createFleet().devices[0].name).toBe('Delivery Van');
  });
});
