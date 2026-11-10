import { describe, expect, it } from 'vitest';
import { coachingEffect, countByStatus, inboxItems, severityOf } from '../safetyInbox';
import { scoreDrivers } from '../safety';

const event = (id, alarm, eventTime, deviceId = 1) => ({
  id,
  deviceId,
  type: alarm === 'overspeed' ? 'deviceOverspeed' : 'alarm',
  eventTime,
  attributes: alarm === 'overspeed' ? {} : { alarm },
});

describe('safety inbox (SAF-01)', () => {
  it('starts every event pending, and keeps the decisions made', () => {
    const items = inboxItems(
      [
        event(1, 'hardBraking', '2026-11-01T08:00:00Z'),
        event(2, 'fatigueDriving', '2026-11-02T08:00:00Z'),
        event(3, 'ignitionOn', '2026-11-03T08:00:00Z'),
        event(4, 'overspeed', '2026-11-04T08:00:00Z'),
      ],
      [{ traccar_event_id: 4, status: 'dismissed', severity: 'minor' }],
      { driverOf: () => 'd1' },
    );
    expect(items.map((item) => [item.eventId, item.status, item.severity])).toEqual([
      [4, 'dismissed', 'minor'],
      [2, 'pending', 'severe'],
      [1, 'pending', 'minor'],
    ]);
    expect(countByStatus(items)).toEqual({ pending: 2, coaching: 0, praise: 0, dismissed: 1 });
    expect(severityOf('accident')).toBe('severe');
  });

  it('a dismissed event leaves the score', () => {
    const trips = [
      {
        deviceId: 1,
        driverUniqueId: 'd1',
        startTime: '2026-11-01T07:00:00Z',
        endTime: '2026-11-01T09:00:00Z',
        distance: 100000,
      },
    ];
    const events = [event(1, 'hardBraking', '2026-11-01T08:00:00Z')];
    expect(scoreDrivers(trips, events)[0].score).toBe(90);
    expect(scoreDrivers(trips, events, { excluded: new Set([1]) })[0].score).toBe(100);
  });

  it('measures events per 100 km before and after coaching', () => {
    const items = [
      {
        driver: 'd1',
        time: '2026-10-05T08:00:00Z',
        status: 'coaching',
        review: { coached_at: '2026-10-10T00:00:00Z' },
      },
      { driver: 'd1', time: '2026-10-06T08:00:00Z', status: 'pending' },
      { driver: 'd1', time: '2026-10-20T08:00:00Z', status: 'pending' },
    ];
    const trips = [
      { driverKey: 'd1', startTime: '2026-10-05T07:00:00Z', distance: 100000 },
      { driverKey: 'd1', startTime: '2026-10-20T07:00:00Z', distance: 100000 },
    ];
    const effect = coachingEffect(items, trips);
    expect(effect.rows).toEqual([{ driver: 'd1', before: 2, after: 1 }]);
    expect(effect.change).toBe(-50);
  });
});
