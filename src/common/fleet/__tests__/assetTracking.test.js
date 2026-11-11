import { describe, expect, it } from 'vitest';
import { beaconsOf, normalizeTag, reportState, whereIsTag } from '../assetTracking';

describe('equipment tracking (OPS-08)', () => {
  it('normalizes tags', () => {
    expect(normalizeTag('AA:BB:CC:DD:EE:01')).toBe('aabbccddee01');
    expect(normalizeTag(' F7826DA6-4FA2 :1:2 ')).toBe('f7826da6-4fa2:1:2');
    expect(normalizeTag('')).toBe('');
  });

  it('reads the beacons a tracker saw', () => {
    const position = {
      attributes: {
        beacon1Uuid: 'F7826DA6-4FA2-4E98-8024-BC5B71E0893E',
        beacon1Major: 1,
        beacon1Minor: 7,
        beacon1Rssi: -70,
        beacon2Namespace: 'EDD1EBEAC04E5DEFA017',
        beacon2Instance: '0BDB87539B67',
        tag3Mac: 'AA:BB:CC:DD:EE:01',
        speed: 0,
      },
    };
    expect(beaconsOf(position)).toEqual([
      'f7826da6-4fa2-4e98-8024-bc5b71e0893e:1:7',
      'edd1ebeac04e5defa017:0bdb87539b67',
      'aabbccddee01',
    ]);
    expect(beaconsOf({ attributes: { bleTag: 'aa-bb-cc-dd-ee-02' } })).toEqual(['aabbccddee02']);
  });

  it('finds the latest vehicle that saw a tag', () => {
    const positions = {
      1: {
        deviceId: 1,
        fixTime: '2026-11-10T08:00:00Z',
        attributes: { tag1Mac: 'AA:BB:CC:DD:EE:01' },
      },
      2: { deviceId: 2, fixTime: '2026-11-10T09:00:00Z', attributes: { bleTag: 'aabbccddee01' } },
      3: { deviceId: 3, fixTime: '2026-11-10T10:00:00Z', attributes: {} },
    };
    expect(whereIsTag('AA:BB:CC:DD:EE:01', positions).deviceId).toBe(2);
    expect(whereIsTag('ff:ff:ff:ff:ff:ff', positions)).toBeNull();
  });

  it('expects a battery tracker by its own interval', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(reportState('2026-11-09T12:00:00Z', 24, now)).toBe('ok');
    expect(reportState('2026-11-07T12:00:00Z', 24, now)).toBe('late');
    expect(reportState('2026-11-10T08:00:00Z', 1, now)).toBe('late');
    expect(reportState(null, 24, now)).toBe('never');
  });
});
