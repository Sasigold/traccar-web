import { describe, expect, it } from 'vitest';
import {
  eventCounts,
  fleetMonth,
  lastMonth,
  monthCosts,
  monthRange,
  previousMonth,
} from '../managementSummary';

describe('management summary', () => {
  it('knows its months', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(lastMonth(new Date(2026, 10, 11))).toBe('2026-10');
    const { from, to } = monthRange('2026-02');
    expect(new Date(from).getDate()).toBe(1);
    expect(new Date(to).getDate()).toBe(28);
    expect(new Date(to).getMonth()).toBe(1);
  });

  it('adds the month up over the fleet', () => {
    const month = fleetMonth(
      [
        { deviceId: 1, distance: 1000, engineHours: 10, spentFuel: 2 },
        { deviceId: 1, distance: 500, engineHours: 5, spentFuel: 1 },
        { deviceId: 2, distance: 3000 },
      ],
      [
        { id: 1, name: 'א' },
        { id: 2, name: 'ב' },
        { id: 3, name: 'ג' },
      ],
    );
    expect(month).toMatchObject({
      distance: 4500,
      engineHours: 15,
      spentFuel: 3,
      active: 2,
      count: 3,
    });
    expect(month.vehicles.map((vehicle) => vehicle.name)).toEqual(['ב', 'א', 'ג']);
  });

  it('counts events and costs', () => {
    expect(
      eventCounts([{ type: 'deviceOverspeed' }, { type: 'alarm' }, { type: 'ignitionOn' }]),
    ).toEqual({
      all: 3,
      speeding: 1,
      alarms: 1,
    });
    expect(
      monthCosts(
        [
          { month: '2026-10-01', category: 'fuel', amount: 100 },
          { month: '2026-10-01', category: 'tolls', amount: 20 },
          { month: '2026-09-01', category: 'fuel', amount: 999 },
        ],
        '2026-10',
      ),
    ).toEqual({ fuel: 100, maintenance: 0, other: 20, total: 120 });
  });
});
