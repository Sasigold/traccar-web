// SAF-05: a weekly leaderboard in fair groups, with streaks of clean days.

// The week (Sunday to Saturday, the Israeli work week) that contains `date`, as [from, to).
export const weekOf = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return [start, end];
};

// rows: [{ driver, group, score, km }] -> per group, ranked by score (ties by km driven).
export const leaderboard = (rows, minKm = 20) => {
  const groups = new Map();
  rows
    .filter((row) => row.score != null && row.km >= minKm)
    .forEach((row) => {
      const key = row.group || 'all';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
  return [...groups.entries()].map(([group, list]) => ({
    group,
    ranking: list
      .sort((a, b) => b.score - a.score || b.km - a.km)
      .map((row, index) => ({ ...row, rank: index + 1 })),
  }));
};

// Days in a row, up to today, with driving and without a safety event.
// days: [{ day: 'YYYY-MM-DD', drove: bool, events: n }] sorted by day.
export const cleanStreak = (days) => {
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day.drove) continue;
    if (day.events > 0) break;
    streak += 1;
  }
  return streak;
};

const dayOf = (time) => {
  const date = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Per driver: the days they drove and the safety events on each, from trips and events.
// driverOf(trip) names the driver of a trip; isSafety(event) says if an event counts.
export const driverDays = (trips, events, driverOf, isSafety) => {
  const result = new Map();
  const day = (driver, key) => {
    if (!result.has(driver)) result.set(driver, new Map());
    const days = result.get(driver);
    if (!days.has(key)) days.set(key, { day: key, drove: false, events: 0 });
    return days.get(key);
  };
  trips.forEach((trip) => {
    const driver = driverOf(trip);
    if (driver) day(driver, dayOf(trip.startTime)).drove = true;
  });
  events.filter(isSafety).forEach((event) => {
    const at = Date.parse(event.eventTime);
    const trip = trips.find(
      (item) =>
        item.deviceId === event.deviceId &&
        Date.parse(item.startTime) <= at &&
        at <= Date.parse(item.endTime),
    );
    const driver = trip && driverOf(trip);
    if (driver) day(driver, dayOf(event.eventTime)).events += 1;
  });
  return new Map(
    [...result.entries()].map(([driver, days]) => [
      driver,
      [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    ]),
  );
};
