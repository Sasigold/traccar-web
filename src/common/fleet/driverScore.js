// SAF-05, SEC-23: the driver's own score card in the driver portal. Pure, unit-tested.
//
// The driver sees what is counted about them: their trips and safety events in the periods
// they had each vehicle (driver_my_periods), the score of this week, the streak of clean days,
// badges, and every event with a way to disagree.

import { eventCategory, safetyScore, DEFAULT_SCORE_WEIGHTS } from './safety';
import { cleanStreak, driverDays, weekOf } from './leaderboard';

export const DISPUTE_REASONS = ['not_me', 'device_error', 'road_conditions', 'other'];

const time = (value) => (typeof value === 'number' ? value : Date.parse(value));

const inPeriod = (periods, deviceId, moment) =>
  periods.some(
    (period) =>
      period.traccar_device_id === deviceId &&
      time(period.starts_at) <= moment &&
      (!period.ends_at || moment < time(period.ends_at)),
  );

/**
 * The trips and safety events that belong to the driver: those in their periods.
 * @param {{ deviceId: number, startTime: string }[]} trips
 * @param {{ id: number, deviceId: number, eventTime: string }[]} events
 * @param {{ traccar_device_id: number, starts_at: string, ends_at?: string | null }[]} periods
 */
export const myDriving = (trips, events, periods) => ({
  trips: (trips || []).filter((trip) => inPeriod(periods, trip.deviceId, time(trip.startTime))),
  events: (events || []).filter(
    (event) => eventCategory(event) && inPeriod(periods, event.deviceId, time(event.eventTime)),
  ),
});

/**
 * The score card: this week's score and km, the clean streak, badges and the events.
 * `excluded` holds the ids of events dismissed after a dispute (they leave the score).
 */
export const scoreCard = (
  { trips, events },
  { now = Date.now(), excluded = new Set(), weights = DEFAULT_SCORE_WEIGHTS } = {},
) => {
  const [weekStart] = weekOf(new Date(now));
  const counted = events.filter((event) => !excluded.has(Number(event.id)));
  const weekTrips = trips.filter((trip) => time(trip.startTime) >= weekStart.getTime());
  const weekEvents = counted.filter((event) => time(event.eventTime) >= weekStart.getTime());
  const km = Math.round(weekTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0) / 100) / 10;
  const counts = {};
  weekEvents.forEach((event) => {
    const category = eventCategory(event);
    counts[category] = (counts[category] || 0) + 1;
  });
  const days = driverDays(
    trips,
    counted,
    () => 'me',
    (event) => Boolean(eventCategory(event)),
  );
  const streak = cleanStreak(days.get('me') || []);
  const score = safetyScore(counts, km, weights);
  return {
    score,
    km,
    events: weekEvents.length,
    streak,
    badges: driverBadges({ score, km, streak, counts }),
  };
};

/**
 * Badges, in the order they are shown. Only what the numbers say; nothing about the person.
 * @param {{ score: number | null, km: number, streak: number, counts: Record<string, number> }} card
 */
export const driverBadges = ({ score, km, streak, counts }) => {
  const badges = [];
  if (streak >= 30) badges.push('streak30');
  else if (streak >= 7) badges.push('streak7');
  else if (streak >= 3) badges.push('streak3');
  if (score != null && score >= 90) badges.push('score90');
  if (km >= 100 && !counts.overspeed) badges.push('noSpeeding');
  if (km >= 100 && !counts.hardBraking && !counts.hardAcceleration && !counts.hardCornering) {
    badges.push('smooth');
  }
  return badges;
};

// The state of an event for the driver: counted, disputed (waiting), accepted or rejected.
export const disputeState = (review) => {
  if (!review?.disputed_at) return 'none';
  return review.dispute_result || 'waiting';
};
