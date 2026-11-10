import { describe, expect, it } from 'vitest';
import { todaySummary } from '../today';

// LIV-23: the counts on the phone's "Today" screen.
const now = Date.parse('2026-11-09T10:00:00Z');
const fresh = new Date(now - 60 * 1000).toISOString();

describe('today summary', () => {
  it('counts moving, stopped and offline vehicles, skipping disabled ones', () => {
    const devices = {
      1: { id: 1, status: 'online' },
      2: { id: 2, status: 'online' },
      3: { id: 3, status: 'online' },
      4: { id: 4, status: 'offline' },
      5: { id: 5, status: 'online', disabled: true },
      6: { id: 6, status: 'online' },
    };
    const positions = {
      1: { speed: 30, fixTime: fresh, attributes: {} },
      2: { speed: 0, fixTime: fresh, attributes: { ignition: true } },
      3: { speed: 0, fixTime: fresh, attributes: {} },
      5: { speed: 40, fixTime: fresh, attributes: {} },
      6: { speed: 30, fixTime: new Date(now - 3600 * 1000).toISOString(), attributes: {} },
    };
    expect(todaySummary(devices, positions, now)).toEqual({
      total: 5,
      moving: 1,
      stopped: 2,
      offline: 2,
    });
  });

  it('is all zeros for an empty fleet', () => {
    expect(todaySummary({}, {}, now)).toEqual({ total: 0, moving: 0, stopped: 0, offline: 0 });
  });
});
