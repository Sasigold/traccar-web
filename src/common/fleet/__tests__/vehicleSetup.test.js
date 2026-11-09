import { describe, expect, it } from 'vitest';
import { MAINTENANCE_TEMPLATES, maintenanceName, maintenancePayload } from '../vehicleSetup';

const template = (id) => MAINTENANCE_TEMPLATES.find((item) => item.id === id);

describe('new vehicle maintenance plans', () => {
  it("counts distance plans from today's odometer, in meters", () => {
    expect(maintenancePayload(template('service'), 'טיפול', 82500)).toEqual({
      name: 'טיפול',
      type: 'totalDistance',
      start: 82_500_000,
      period: 15_000_000,
    });
    expect(maintenancePayload(template('service'), 'טיפול', '').start).toBe(0);
  });

  it('counts time plans from today, in milliseconds', () => {
    const now = Date.parse('2026-11-10T00:00:00Z');
    expect(maintenancePayload(template('yearly'), 'טסט', 0, now)).toEqual({
      name: 'טסט',
      type: 'fixTime',
      start: now,
      period: 365 * 24 * 60 * 60 * 1000,
    });
  });

  it("names each vehicle's own record", () => {
    expect(maintenanceName('טיפול 15,000 ק"מ', 'Delivery Van')).toBe(
      'טיפול 15,000 ק"מ · Delivery Van',
    );
  });
});
