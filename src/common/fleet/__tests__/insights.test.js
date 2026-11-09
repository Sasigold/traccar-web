import { describe, expect, it } from 'vitest';
import { computeInsights } from '../insights';

const now = new Date(2026, 10, 9, 8, 0); // Monday morning
const day = (offset) => new Date(2026, 10, 9 - offset, 12).toISOString();
const devices = {
  1: { id: 1, name: 'טנדר' },
  2: { id: 2, name: 'משאית' },
  3: { id: 3, name: 'ואן' },
};

// 28 days: vehicle 1 drove 50 km a day until 5 days ago; vehicle 2 burns more fuel this week;
// vehicle 3 drove three times its usual this week.
const daily = [];
for (let offset = 1; offset <= 28; offset += 1) {
  daily.push({
    deviceId: 1,
    startTime: day(offset),
    distance: offset > 5 ? 50000 : 0,
    spentFuel: offset > 5 ? 5 : 0,
  });
  daily.push({
    deviceId: 2,
    startTime: day(offset),
    distance: 60000,
    spentFuel: offset <= 7 ? 9 : 6,
  });
  daily.push({
    deviceId: 3,
    startTime: day(offset),
    distance: offset <= 7 ? 90000 : 30000,
    spentFuel: offset <= 7 ? 9 : 3,
  });
}

describe('morning insights (AI-02)', () => {
  it('finds a stopped vehicle, a fuel jump and a mileage jump, ranked, at most four', () => {
    const findings = computeInsights(
      {
        daily,
        devices,
        trips: [
          { deviceId: 2, startTime: new Date(2026, 10, 8, 23, 30).toISOString() },
          { deviceId: 2, startTime: new Date(2026, 10, 8, 10, 0).toISOString() },
        ],
        positions: { 3: { deviceId: 3, attributes: { dtcs: 'P0420' } } },
      },
      now,
    );
    expect(findings).toHaveLength(4);
    const kinds = findings.map((finding) => finding.kind);
    expect(kinds).toContain('notMoving');
    expect(kinds).toContain('fuelJump');
    const idle = findings.find((finding) => finding.kind === 'notMoving');
    expect(idle.values).toEqual({ name: 'טנדר', days: 5 });
    const fuel = findings.find((finding) => finding.kind === 'fuelJump');
    expect(fuel.values).toMatchObject({ name: 'משאית', now: '15.0', before: '10.0' });
    expect(findings.map((finding) => finding.score)).toEqual(
      [...findings.map((finding) => finding.score)].sort((a, b) => b - a),
    );
  });

  it('says nothing when the fleet behaves as usual', () => {
    const quiet = [];
    for (let offset = 1; offset <= 28; offset += 1) {
      quiet.push({ deviceId: 1, startTime: day(offset), distance: 40000, spentFuel: 4 });
    }
    expect(computeInsights({ daily: quiet, devices }, now)).toEqual([]);
  });

  it('counts trips outside working hours and fault codes seen in several vehicles', () => {
    const findings = computeInsights(
      {
        devices,
        trips: [{ deviceId: 1, startTime: new Date(2026, 10, 7, 11, 0).toISOString() }], // Saturday
        positions: {
          1: { deviceId: 1, attributes: { dtcs: 'P0300' } },
          2: { deviceId: 2, attributes: { faults: 'p0300' } },
        },
      },
      now,
    );
    expect(findings.map((finding) => finding.kind).sort()).toEqual(['afterHours', 'faultMany']);
    expect(findings.find((finding) => finding.kind === 'faultMany').values.vehicles).toBe(2);
  });
});
