import { describe, expect, it } from 'vitest';
import { activityGroup, activityOf, activitySince, formatShortDuration } from '../activity';

const now = Date.parse('2026-11-09T12:00:00Z');
const at = (minutesAgo) => new Date(now - minutesAgo * 60000).toISOString();
const online = { status: 'online' };

describe('activity', () => {
  it('tells moving, idling, stopped, stale and offline apart', () => {
    expect(activityOf(online, { fixTime: at(1), speed: 30 }, now)).toBe('moving');
    expect(
      activityOf(online, { fixTime: at(1), speed: 0, attributes: { ignition: true } }, now),
    ).toBe('idling');
    expect(
      activityOf(online, { fixTime: at(1), speed: 0, attributes: { ignition: false } }, now),
    ).toBe('stopped');
    expect(activityOf(online, { fixTime: at(25), speed: 30 }, now)).toBe('stale');
    expect(activityOf({ status: 'offline' }, { fixTime: at(1), speed: 30 }, now)).toBe('offline');
    expect(activityOf(online, null, now)).toBe('offline');
  });

  it('groups activities for the tiles', () => {
    expect(activityGroup('moving')).toBe('moving');
    expect(activityGroup('idling')).toBe('stopped');
    expect(activityGroup('stale')).toBe('offline');
  });

  it('reads how long the vehicle is in its state from motionTime', () => {
    const device = { motionState: false, motionTime: at(23) };
    expect(activitySince(device, 'stopped')).toBe(now - 23 * 60000);
    expect(activitySince(device, 'moving')).toBeNull();
    expect(activitySince({}, 'stopped')).toBeNull();
  });

  it('formats short durations', () => {
    const t = (key) =>
      ({ sharedMinuteAbbreviation: 'm', sharedHourAbbreviation: 'h', sharedDaysCount: '{0} d' })[
        key
      ];
    expect(formatShortDuration(23 * 60000, t)).toBe('23 m');
    expect(formatShortDuration(125 * 60000, t)).toBe('2:05 h');
    expect(formatShortDuration(3 * 86400000, t)).toBe('3 d');
  });
});
