// OPS-05: the working day of each driver from the first and last ignition (trips), for payroll.
// trips: [{ driverUniqueId, startTime, endTime }]. Days are local calendar days.
const dayKey = (time) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const workDays = (trips) => {
  const days = new Map();
  trips.forEach((trip) => {
    if (!trip.driverUniqueId) return;
    const key = `${trip.driverUniqueId}|${dayKey(trip.startTime)}`;
    const start = Date.parse(trip.startTime);
    const end = Date.parse(trip.endTime);
    const day = days.get(key) || {
      driver: trip.driverUniqueId,
      day: dayKey(trip.startTime),
      start,
      end,
      driving: 0,
    };
    day.start = Math.min(day.start, start);
    day.end = Math.max(day.end, end);
    day.driving += end - start;
    days.set(key, day);
  });
  return [...days.values()].sort(
    (a, b) => a.driver.localeCompare(b.driver) || a.day.localeCompare(b.day),
  );
};

// A week per driver: days worked, total span hours and driving hours.
export const weeklyTotals = (days) => {
  const result = new Map();
  days.forEach((day) => {
    const entry = result.get(day.driver) || {
      driver: day.driver,
      days: 0,
      spanMs: 0,
      drivingMs: 0,
    };
    entry.days += 1;
    entry.spanMs += day.end - day.start;
    entry.drivingMs += day.driving;
    result.set(day.driver, entry);
  });
  return [...result.values()];
};
