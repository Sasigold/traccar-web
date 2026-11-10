import { describe, expect, it } from 'vitest';
import { batteryHealth, crankVoltages, repeatedFaults, serviceReasons } from '../predict';

// AI-06: warnings from data the devices already send.
const start = Date.parse('2026-11-09T07:00:00Z');
const at = (s) => new Date(start + s * 1000).toISOString();
const starts = (volts) =>
  volts.flatMap((v, day) => {
    const base = day * 86400;
    return [
      { fixTime: at(base - 60), attributes: { ignition: false, power: 12.5 } },
      { fixTime: at(base), attributes: { ignition: true, power: v } },
      { fixTime: at(base + 20), attributes: { ignition: true, power: 14.1 } },
    ];
  });

describe('the 12V battery', () => {
  it('reads the voltage dip at each start', () => {
    expect(crankVoltages(starts([10.8, 10.6])).map((c) => c.volts)).toEqual([10.8, 10.6]);
  });

  it('is weak when starts dip below 9.6V, watched when it keeps falling', () => {
    expect(batteryHealth(crankVoltages(starts([9.2, 9.3, 9.1, 9.4]))).state).toBe('weak');
    expect(batteryHealth(crankVoltages(starts([11, 10.9, 10.8, 10.4, 10.3, 10.2]))).state).toBe(
      'watch',
    );
    expect(batteryHealth(crankVoltages(starts([10.9, 11, 10.8, 10.9]))).state).toBe('ok');
    expect(batteryHealth([]).state).toBe('unknown');
  });
});

describe('repeated faults', () => {
  it('flags a code shared by vehicles of one model', () => {
    const codes = [
      { deviceId: 1, code: 'P0420', model: 'Transit' },
      { deviceId: 2, code: 'P0420', model: 'Transit' },
      { deviceId: 3, code: 'P0420', model: 'Transit' },
      { deviceId: 3, code: 'P0420', model: 'Transit' },
      { deviceId: 4, code: 'P0420', model: 'Hilux' },
    ];
    expect(repeatedFaults(codes)).toEqual([
      { model: 'Transit', code: 'P0420', count: 3, deviceIds: [1, 2, 3] },
    ]);
  });
});

describe('needs service in the list (AI-06)', () => {
  it('reads fault codes and a low resting battery', () => {
    expect(serviceReasons({ attributes: { dtcs: 'P0420, P0301' } })).toEqual([
      { type: 'faults', codes: ['P0420', 'P0301'] },
    ]);
    expect(serviceReasons({ attributes: { ignition: false, power: 11.4 } })).toEqual([
      { type: 'battery', volts: 11.4 },
    ]);
    expect(serviceReasons({ attributes: { ignition: false, power: 23.1 } })[0].type).toBe(
      'battery',
    );
  });

  it('stays quiet while driving or when all is well', () => {
    expect(serviceReasons({ attributes: { ignition: true, power: 11.4 } })).toEqual([]);
    expect(serviceReasons({ attributes: { ignition: false, power: 12.6 } })).toEqual([]);
    expect(serviceReasons({ attributes: { dtcs: '' } })).toEqual([]);
    expect(serviceReasons(null)).toEqual([]);
  });
});
