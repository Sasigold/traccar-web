// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { eventCategory } from './safety';

// SAF-01: the safety inbox. Pure, unit-tested.
//
// Every safety event starts pending and leaves as coaching, praise or dismissed. Severe events
// (an accident, fatigue) go to a named person; minor ones can go to the driver for a short
// self-review. The coaching effect compares the driver's event rate per 100 km before and after
// the coaching.

export const SEVERE = ['accident', 'fatigueDriving'];
export const STATUSES = ['pending', 'coaching', 'praise', 'dismissed'];
export const DRIVER_ANSWERS = ['unavoidable', 'my_mistake', 'device_error', 'other'];

export const severityOf = (category) => (SEVERE.includes(category) ? 'severe' : 'minor');

const time = (value) => (typeof value === 'number' ? value : Date.parse(value));

// Traccar events + saved reviews -> inbox items, newest first. driverOf(event) -> driver key.
export const inboxItems = (events, reviews, { driverOf = () => null } = {}) => {
  const byEvent = new Map(reviews.map((review) => [Number(review.traccar_event_id), review]));
  return events
    .map((event) => {
      const category = eventCategory(event);
      if (!category) return null;
      const review = byEvent.get(Number(event.id));
      return {
        eventId: event.id,
        deviceId: event.deviceId,
        time: event.eventTime,
        category,
        driver: driverOf(event),
        severity: review?.severity || severityOf(category),
        status: review?.status || 'pending',
        review: review || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => time(b.time) - time(a.time));
};

export const countByStatus = (items) =>
  Object.fromEntries(
    STATUSES.map((status) => [status, items.filter((item) => item.status === status).length]),
  );

// Per coached driver: events per 100 km before the first coaching in the period and after it.
// trips: { driverKey, startTime, distance (m) }; items: inbox items with `driver`.
export const coachingEffect = (items, trips) => {
  const coached = new Map();
  items.forEach((item) => {
    const at = item.review?.coached_at && time(item.review.coached_at);
    if (item.driver && at && (!coached.has(item.driver) || at < coached.get(item.driver))) {
      coached.set(item.driver, at);
    }
  });
  const rate = (driver, from, to) => {
    const km =
      trips
        .filter(
          (trip) =>
            trip.driverKey === driver && time(trip.startTime) >= from && time(trip.startTime) < to,
        )
        .reduce((total, trip) => total + (trip.distance || 0), 0) / 1000;
    const count = items.filter(
      (item) =>
        item.driver === driver &&
        item.status !== 'dismissed' &&
        time(item.time) >= from &&
        time(item.time) < to,
    ).length;
    return km >= 20 ? (count * 100) / km : null;
  };
  const rows = [...coached].map(([driver, at]) => ({
    driver,
    before: rate(driver, -Infinity, at),
    after: rate(driver, at, Infinity),
  }));
  const comparable = rows.filter(
    (row) => row.before != null && row.after != null && row.before > 0,
  );
  const change = comparable.length
    ? Math.round(
        (comparable.reduce((total, row) => total + (row.after - row.before) / row.before, 0) /
          comparable.length) *
          100,
      )
    : null;
  return { rows, change };
};
