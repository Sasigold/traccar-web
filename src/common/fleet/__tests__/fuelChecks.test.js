import { describe, expect, it } from 'vitest';
import { idleCost, locationFinding, parkedDrops, rulesOn } from '../fuelChecks';

describe('fuel checks (OPS-02)', () => {
  const stops = [
    {
      startTime: '2026-11-05T10:00:00Z',
      endTime: '2026-11-05T10:30:00Z',
      latitude: 32.08,
      longitude: 34.78,
    },
  ];

  it('a fill while the vehicle was driving, or far from where it stood, is flagged', () => {
    expect(locationFinding({ occurred_at: '2026-11-05T12:00:00Z' }, stops)).toEqual({
      rule: 'notAtVehicle',
      reason: 'moving',
    });
    expect(locationFinding({ occurred_at: '2026-11-05T10:40:00Z' }, stops)).toBeNull();
    const far = locationFinding(
      { occurred_at: '2026-11-05T10:10:00Z', latitude: 32.18, longitude: 34.78 },
      stops,
    );
    expect(far).toMatchObject({ rule: 'notAtVehicle', reason: 'far', km: 11.1 });
    expect(
      locationFinding(
        { occurred_at: '2026-11-05T10:10:00Z', latitude: 32.0805, longitude: 34.78 },
        stops,
      ),
    ).toBeNull();
  });

  it('a fuel drop counts only with the engine off', () => {
    const findings = parkedDrops(
      [
        { type: 'deviceFuelDrop', deviceId: 1, positionId: 10, eventTime: 't1' },
        { type: 'deviceFuelDrop', deviceId: 1, positionId: 11, eventTime: 't2' },
        { type: 'alarm', deviceId: 1, positionId: 10 },
      ],
      { 10: { attributes: { ignition: false } }, 11: { attributes: { ignition: true } } },
    );
    expect(findings.map((finding) => finding.time)).toEqual(['t1']);
  });

  it('idle is engine time that was not driving, in liters and shekels', () => {
    const result = idleCost({
      summaries: [
        { deviceId: 1, engineHours: 10 * 3600000 },
        { deviceId: 2, engineHours: 2 * 3600000 },
      ],
      trips: [
        { deviceId: 1, duration: 8 * 3600000 },
        { deviceId: 2, duration: 2 * 3600000 },
      ],
      price: 7.5,
      litersPerHour: 1.2,
    });
    expect(result.rows).toEqual([{ deviceId: 1, hours: 2, liters: 2.4, cost: 18 }]);
    expect(result.total).toBe(18);
    expect(idleCost({ summaries: [], trips: [], price: null, litersPerHour: 1 }).total).toBeNull();
  });

  it('every check is on unless switched off', () => {
    expect(rulesOn({ fuelDrop: false })).toMatchObject({ fuelDrop: false, notAtVehicle: true });
  });
});
