import { describe, expect, it } from 'vitest';
import { dailyCheckRequired, missedChecks } from '../missedChecks';

describe('missedChecks', () => {
  const vehicles = [
    { id: 'a', plate_number: '1', traccar_device_id: 1 },
    { id: 'b', plate_number: '2', traccar_device_id: 2 },
    { id: 'c', plate_number: '3', traccar_device_id: 3 },
    { id: 'd', plate_number: '4', traccar_device_id: null },
  ];

  it('lists the vehicles that drove without a check', () => {
    const summary = [
      { deviceId: 1, distance: 12000 },
      { deviceId: 2, distance: 8000 },
      { deviceId: 3, distance: 0 },
    ];
    expect(missedChecks(vehicles, summary, [{ vehicle_id: 'b' }]).map((v) => v.id)).toEqual(['a']);
  });

  it('is empty without data', () => {
    expect(missedChecks(vehicles, null, null)).toEqual([]);
  });

  it('asks for a daily check only with an active daily checklist', () => {
    expect(dailyCheckRequired([{ frequency: 'weekly', active: true }])).toBe(false);
    expect(dailyCheckRequired([{ frequency: 'daily', active: false }])).toBe(false);
    expect(dailyCheckRequired([{ frequency: 'daily', active: true }])).toBe(true);
  });
});
