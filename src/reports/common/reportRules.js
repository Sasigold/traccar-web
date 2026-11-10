// REP-14: rules for single reports.

// Stops: at least this long, and only with the engine on (idling) when asked.
export const STOP_MINIMUMS = [0, 5, 15, 30, 60];

export const filterStops = (rows, { minMinutes = 0, idleOnly = false } = {}) =>
  rows.filter(
    (row) => (row.duration || 0) >= minMinutes * 60000 && (!idleOnly || (row.engineHours || 0) > 0),
  );

// Trips: liters per 100 km, when both are known.
export const litersPer100 = (spentFuel, distanceMeters) =>
  spentFuel > 0 && distanceMeters > 0 ? (spentFuel / distanceMeters) * 100000 : null;

// Events: the speed with the limit it crossed ("112 (limit 90)").
export const overspeedText = (attributes, formatSpeed, limitLabel) => {
  const speed = attributes?.speed;
  if (!(speed > 0)) return null;
  const limit = attributes?.speedLimit;
  return limit > 0
    ? `${formatSpeed(speed)} (${limitLabel.replace('{0}', formatSpeed(limit))})`
    : formatSpeed(speed);
};

// Geofence visits: still inside when the exit has not happened yet.
export const visitDuration = (visit, now = Date.now()) => {
  const start = Date.parse(visit.startTime);
  const end = visit.endTime ? Date.parse(visit.endTime) : NaN;
  if (!Number.isFinite(start)) return { open: false, duration: null };
  if (!Number.isFinite(end)) return { open: true, duration: now - start };
  return { open: false, duration: end - start };
};
