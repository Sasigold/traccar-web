import { describe, expect, it } from 'vitest';
import { disputeState, driverBadges, myDriving, scoreCard } from '../driverScore';

const at = (day, hour) => new Date(2026, 10, day, hour).toISOString();
// Wednesday 18.11.2026; the week starts on Sunday 15.11.
const now = new Date(2026, 10, 18, 18).getTime();

const periods = [
  { traccar_device_id: 1, starts_at: at(1, 0), ends_at: at(16, 0) },
  { traccar_device_id: 2, starts_at: at(16, 0), ends_at: null },
];

const trip = (deviceId, day, km) => ({
  deviceId,
  startTime: at(day, 8),
  endTime: at(day, 9),
  distance: km * 1000,
});
const event = (id, deviceId, day, type = 'deviceOverspeed', alarm) => ({
  id,
  deviceId,
  type,
  eventTime: at(day, 8),
  attributes: alarm ? { alarm } : {},
});

describe('myDriving', () => {
  it('keeps only what happened in the driver periods', () => {
    const trips = [trip(1, 15, 50), trip(1, 17, 80), trip(2, 17, 60), trip(3, 17, 10)];
    const events = [
      event(1, 1, 15),
      event(2, 1, 17), // device 1 after she gave it back
      event(3, 2, 17),
      event(4, 2, 17, 'ignitionOn'), // not a safety event
    ];
    const mine = myDriving(trips, events, periods);
    expect(mine.trips.map((item) => item.distance)).toEqual([50000, 60000]);
    expect(mine.events.map((item) => item.id)).toEqual([1, 3]);
  });
});

describe('scoreCard', () => {
  it('scores the week and counts the clean streak', () => {
    const trips = [trip(2, 16, 200), trip(2, 17, 200), trip(2, 18, 200), trip(1, 12, 50)];
    const events = [event(7, 1, 12)];
    const card = scoreCard({ trips, events }, { now });
    expect(card.km).toBe(600);
    expect(card.events).toBe(0);
    expect(card.score).toBe(100);
    // 16, 17 and 18 without events; the 12th had one.
    expect(card.streak).toBe(3);
    expect(card.badges).toEqual(['streak3', 'score90', 'noSpeeding', 'smooth']);
  });

  it('leaves out an event accepted after a dispute', () => {
    const trips = [trip(2, 17, 100)];
    const events = [event(9, 2, 17)];
    expect(scoreCard({ trips, events }, { now }).events).toBe(1);
    const card = scoreCard({ trips, events }, { now, excluded: new Set([9]) });
    expect(card.events).toBe(0);
    expect(card.score).toBe(100);
  });
});

describe('driverBadges', () => {
  it('gives the longest streak only, and nothing for little driving', () => {
    expect(driverBadges({ score: 95, km: 30, streak: 31, counts: {} })).toEqual([
      'streak30',
      'score90',
    ]);
    expect(driverBadges({ score: null, km: 5, streak: 1, counts: {} })).toEqual([]);
    expect(driverBadges({ score: 70, km: 150, streak: 8, counts: { hardBraking: 1 } })).toEqual([
      'streak7',
      'noSpeeding',
    ]);
  });
});

describe('disputeState', () => {
  it('reads the review', () => {
    expect(disputeState(null)).toBe('none');
    expect(disputeState({ disputed_at: 'x' })).toBe('waiting');
    expect(disputeState({ disputed_at: 'x', dispute_result: 'accepted' })).toBe('accepted');
  });
});
