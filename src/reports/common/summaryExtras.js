import dayjs from 'dayjs';

// REP-14: what the summary adds to Traccar's figures. Pure, unit-tested.

// Days with any distance, per vehicle, from a daily summary.
export const activeDaysByDevice = (dailyRows) => {
  const days = new Map();
  (dailyRows || []).forEach((row) => {
    if (!(row.distance > 0)) return;
    const set = days.get(row.deviceId) || new Set();
    set.add(dayjs(row.startTime).format('YYYY-MM-DD'));
    days.set(row.deviceId, set);
  });
  return new Map([...days].map(([deviceId, set]) => [deviceId, set.size]));
};

// Litres per 100 km (distance in metres); nothing without fuel or distance.
export const fuelPer100 = (spentFuel, distance) =>
  spentFuel > 0 && distance >= 1000 ? Math.round((spentFuel / distance) * 100000 * 10) / 10 : null;

// Driving time per vehicle (ms), from the trips report.
export const drivingByDevice = (trips) => {
  const total = new Map();
  (trips || []).forEach((trip) => {
    total.set(trip.deviceId, (total.get(trip.deviceId) || 0) + (trip.duration || 0));
  });
  return total;
};

// Share of the engine's running time spent standing (0-100), from engine hours and driving.
export const idlePercent = (engineHours, drivingMs) => {
  if (!(engineHours > 0) || drivingMs == null) return null;
  const idle = Math.max(0, engineHours - drivingMs);
  return Math.round((idle / engineHours) * 100);
};

// Distance per day over every vehicle, for the chart: [{ label, value (m) }].
export const distancePerDay = (dailyRows, from, to) => {
  const byDay = new Map();
  (dailyRows || []).forEach((row) => {
    const day = dayjs(row.startTime).format('YYYY-MM-DD');
    byDay.set(day, (byDay.get(day) || 0) + (row.distance || 0));
  });
  const points = [];
  for (
    let day = dayjs(from).startOf('day');
    day.isBefore(dayjs(to)) && points.length < 400;
    day = day.add(1, 'day')
  ) {
    const key = day.format('YYYY-MM-DD');
    points.push({ key, label: day.format('DD/MM'), value: byDay.get(key) || 0 });
  }
  return points;
};
