import { describe, expect, it } from 'vitest';
import { byImportance, importanceRank } from '../importance';

const now = Date.parse('2026-11-09T10:00:00Z');
const fresh = '2026-11-09T09:59:00Z';
const online = (id, name, extra = {}) => ({
  id,
  name,
  status: 'online',
  lastUpdate: fresh,
  attributes: {},
  ...extra,
});
const at = (speed, attributes = {}) => ({ fixTime: fresh, speed, attributes });

describe('important first (LIV-11)', () => {
  it('ranks alarms, speeding, a fresh disconnection, idling, driving, standing, long offline', () => {
    const devices = [
      online(1, 'עומד'),
      online(2, 'נוסע'),
      online(3, 'חריגה', { attributes: { speedLimit: 40 } }),
      online(4, 'סרק'),
      { id: 5, name: 'מנותק מזמן', status: 'offline', lastUpdate: '2026-11-01T00:00:00Z' },
      { id: 6, name: 'נותק עכשיו', status: 'offline', lastUpdate: '2026-11-09T09:30:00Z' },
      online(7, 'התראה'),
    ];
    const positions = {
      1: at(0),
      2: at(20),
      3: at(50),
      4: at(0, { ignition: true }),
      7: at(0, { alarm: 'sos' }),
    };
    expect(devices.map((device) => importanceRank(device, positions[device.id], now))).toEqual([
      5, 4, 1, 3, 6, 2, 0,
    ]);
    expect([...devices].sort(byImportance(positions, now)).map((device) => device.id)).toEqual([
      7, 3, 6, 4, 2, 1, 5,
    ]);
  });
});
