import { describe, expect, it } from 'vitest';
import { checkinUrl, parseCheckin, tripDriverKey } from '../checkin';

describe('driver check-in (SAF-02)', () => {
  it('a vehicle QR opens the check-in with the vehicle and its code', () => {
    const url = checkinUrl('https://fleet.example.com/app', 12, 'abc123');
    expect(url).toBe('https://fleet.example.com/app/driver/checkin?d=12&c=abc123');
    expect(parseCheckin(url)).toEqual({ deviceId: 12, code: 'abc123' });
    expect(parseCheckin('https://example.com/other?d=1&c=x')).toBeNull();
    expect(parseCheckin('not a url')).toBeNull();
    expect(parseCheckin('https://x/driver/checkin?d=abc&c=x')).toBeNull();
  });

  it('a trip has the identified driver, else the assignment, else nobody', () => {
    const resolve = (deviceId) => (deviceId === 1 ? 'assigned' : null);
    expect(
      tripDriverKey({ deviceId: 1, driverUniqueId: 'tag', startTime: '2026-11-01' }, resolve),
    ).toBe('tag');
    expect(tripDriverKey({ deviceId: 1, startTime: '2026-11-01' }, resolve)).toBe('assigned');
    expect(tripDriverKey({ deviceId: 2, startTime: '2026-11-01' }, resolve)).toBeNull();
  });
});
