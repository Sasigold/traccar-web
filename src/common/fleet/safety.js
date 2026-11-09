// Roadmap stage 4: driver safety score and driving / rest hours (pure, unit-tested).
//
// The numbers here are parameters, not law: the roadmap's legal note says they must be
// confirmed by a transport safety officer, so the organization can change every one of them.

// Penalty weights per event, applied to events per 100 km (Geotab-style model, roadmap 2.2).
export const DEFAULT_SCORE_WEIGHTS = {
  overspeed: 20,
  hardBraking: 10,
  hardAcceleration: 10,
  hardCornering: 10,
  fatigueDriving: 15,
  accident: 30,
  idle: 2,
};

// Below this distance the score isn't meaningful (a single event would dominate it).
export const MIN_SCORE_KM = 20;

// Traccar event -> score category, or null when the event doesn't count.
export const eventCategory = (event) => {
  if (event.type === 'deviceOverspeed') {
    return 'overspeed';
  }
  if (event.type === 'alarm') {
    const alarm = event.attributes?.alarm;
    return Object.prototype.hasOwnProperty.call(DEFAULT_SCORE_WEIGHTS, alarm) ? alarm : null;
  }
  return null;
};

// 0-100, higher is safer; null when there's too little driving to judge.
export const safetyScore = (counts, km, weights = DEFAULT_SCORE_WEIGHTS) => {
  if (!km || km < MIN_SCORE_KM) {
    return null;
  }
  const penalty = Object.entries(counts).reduce(
    (sum, [category, count]) => sum + (weights[category] || 0) * ((count * 100) / km),
    0,
  );
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
};

const time = (value) => (typeof value === 'number' ? value : Date.parse(value));

// Which driver drove a vehicle at a moment: the trip that contains it.
const tripAt = (trips, deviceId, moment) =>
  trips.find(
    (trip) =>
      trip.deviceId === deviceId && time(trip.startTime) <= moment && moment <= time(trip.endTime),
  );

// Per driver: km, event counts and score. Trips carry driverUniqueId (Traccar identifies the
// driver by iButton / RFID); events are given to the driver of the trip they happened in.
// `fallbackDriver(deviceId, moment)` covers trips without an identified driver.
export const scoreDrivers = (
  trips,
  events,
  { weights = DEFAULT_SCORE_WEIGHTS, fallbackDriver = () => null, excluded = null } = {},
) => {
  const drivers = new Map();
  const entry = (key) => {
    if (!drivers.has(key)) {
      drivers.set(key, { driver: key, km: 0, counts: {}, events: 0 });
    }
    return drivers.get(key);
  };
  const driverOf = (trip, deviceId, moment) =>
    trip?.driverUniqueId || fallbackDriver(deviceId, moment) || null;
  trips.forEach((trip) => {
    const key = driverOf(trip, trip.deviceId, time(trip.startTime));
    if (key) {
      entry(key).km += (trip.distance || 0) / 1000;
    }
  });
  events.forEach((event) => {
    const category = eventCategory(event);
    // SAF-01: an event dismissed in the safety inbox does not count.
    if (!category || excluded?.has(event.id)) {
      return;
    }
    const moment = time(event.eventTime);
    const key = driverOf(tripAt(trips, event.deviceId, moment), event.deviceId, moment);
    if (key) {
      const target = entry(key);
      target.counts[category] = (target.counts[category] || 0) + 1;
      target.events += 1;
    }
  });
  return [...drivers.values()]
    .map((item) => ({
      ...item,
      km: Math.round(item.km * 10) / 10,
      score: safetyScore(item.counts, item.km, weights),
    }))
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
};

// Driving and rest limits (roadmap 2.3 / 4.7, regulation 168), all in minutes.
export const DEFAULT_HOURS_RULES = {
  maxDailyDriving: 12 * 60,
  maxWeeklyDriving: 68 * 60,
  maxContinuousDriving: 4 * 60,
  minBreak: 30,
  minDailyRest: 7 * 60,
};

// Trips -> merged driving intervals; stops shorter than the break don't interrupt driving.
export const drivingIntervals = (trips, minBreak = DEFAULT_HOURS_RULES.minBreak) => {
  const sorted = trips
    .map((trip) => ({ start: time(trip.startTime), end: time(trip.endTime) }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (last && interval.start - last.end < minBreak * 60000) {
      last.end = Math.max(last.end, interval.end);
      last.driving += interval.end - interval.start;
    } else {
      merged.push({ ...interval, driving: interval.end - interval.start });
    }
  });
  return merged;
};

const dayKey = (ms) => {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Daily driving minutes and rule violations for one driver's trips.
export const drivingHours = (trips, rules = DEFAULT_HOURS_RULES) => {
  const intervals = drivingIntervals(trips, rules.minBreak);
  const days = new Map();
  const violations = [];
  intervals.forEach((interval, index) => {
    const key = dayKey(interval.start);
    days.set(key, (days.get(key) || 0) + interval.driving / 60000);
    const continuous = (interval.end - interval.start) / 60000;
    if (continuous > rules.maxContinuousDriving) {
      violations.push({ type: 'continuous', day: key, minutes: Math.round(continuous) });
    }
    const previous = intervals[index - 1];
    if (previous && dayKey(previous.end) !== key) {
      const rest = (interval.start - previous.end) / 60000;
      if (rest < rules.minDailyRest) {
        violations.push({ type: 'rest', day: key, minutes: Math.round(rest) });
      }
    }
  });
  const daily = [...days.entries()]
    .map(([day, minutes]) => ({ day, minutes: Math.round(minutes) }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  daily.forEach((item) => {
    if (item.minutes > rules.maxDailyDriving) {
      violations.push({ type: 'daily', day: item.day, minutes: item.minutes });
    }
  });
  // Rolling 7 days ending on each driving day.
  daily.forEach((item) => {
    const end = Date.parse(`${item.day}T00:00:00`);
    const week = daily
      .filter((other) => {
        const at = Date.parse(`${other.day}T00:00:00`);
        return at <= end && at > end - 7 * 86400000;
      })
      .reduce((sum, other) => sum + other.minutes, 0);
    if (week > rules.maxWeeklyDriving) {
      violations.push({ type: 'weekly', day: item.day, minutes: week });
    }
  });
  const total = daily.reduce((sum, item) => sum + item.minutes, 0);
  return { daily, violations, totalMinutes: total };
};
