import { describe, expect, it } from 'vitest';
import {
  batteryPercent,
  chargingSessions,
  enoughFor,
  evFit,
  rangeKm,
  sessionCost,
  sessionEnergy,
} from '../ev';

const at = (h, level, speed = 0) => ({
  fixTime: new Date(Date.UTC(2026, 10, 10, 0, h * 60)).toISOString(),
  speed,
  attributes: { batteryLevel: level },
});

describe('electric vehicles (OPS-09)', () => {
  it('reads the battery level', () => {
    expect(batteryPercent({ attributes: { batteryLevel: 64 } })).toBe(64);
    expect(batteryPercent({ attributes: { soc: '80' } })).toBe(80);
    expect(batteryPercent({ attributes: { batteryLevel: 140 } })).toBeNull();
  });

  it('finds charging sessions while standing', () => {
    const history = [
      at(0, 70, 30),
      at(1, 40, 30),
      at(2, 40),
      at(3, 55),
      at(4, 80),
      at(5, 80, 25),
      at(6, 78),
      at(7, 80),
    ];
    expect(chargingSessions(history)).toEqual([
      {
        start: at(2, 0).fixTime,
        end: at(4, 0).fixTime,
        from: 40,
        to: 80,
      },
    ]);
  });

  it('prices a session and the range left', () => {
    const session = { from: 40, to: 80 };
    expect(sessionEnergy(session, 60)).toBe(24);
    expect(sessionCost(session, 60, 0.6)).toBeCloseTo(14.4);
    expect(rangeKm(50, 60, 16)).toBe(150);
    expect(enoughFor(120, 50, 60, 16)).toBe(true);
    expect(enoughFor(200, 50, 60, 16)).toBe(false);
  });

  it('tells which vehicles could be electric', () => {
    expect(evFit([80, 120, 60, 200, 90, 110])).toMatchObject({ fits: true, days: 6, longest: 200 });
    expect(evFit([80, 320, 60, 300, 90, 110]).fits).toBe(false);
    expect(evFit([80, 90]).fits).toBeNull();
  });
});
