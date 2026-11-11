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
// SAF-06: speeding judged against the road's own limit (Traccar's speedLimit), in bands.
export const SPEED_BANDS = [
  { key: 'minor', over: 0 },
  { key: 'medium', over: 10 },
  { key: 'severe', over: 20 },
];

// speed and limit in km/h; null when there is no limit or no speeding.
export const speedingBand = (speedKmh, limitKmh) => {
  if (!(limitKmh > 0) || !(speedKmh > limitKmh)) return null;
  const over = speedKmh - limitKmh;
  return over > 20 ? 'severe' : over > 10 ? 'medium' : 'minor';
};

// From an overspeed event's attributes (knots): the band, or null.
export const overspeedBand = (attributes) =>
  speedingBand(
    (Number(attributes?.speed) || 0) * 1.852,
    (Number(attributes?.speedLimit) || 0) * 1.852,
  );

// REP-14: the geofences report by geofence: visits, vehicles, time inside (open visits up to
// now), the average visit and how many are still inside. Most time first.
export const byGeofence = (visits, now = Date.now()) => {
  const groups = new Map();
  visits.forEach((visit) => {
    const group = groups.get(visit.geofenceId) || {
      geofenceId: visit.geofenceId,
      visits: 0,
      devices: new Set(),
      total: 0,
      inside: 0,
    };
    const { open, duration } = visitDuration(visit, now);
    group.visits += 1;
    group.devices.add(visit.deviceId);
    group.total += duration || 0;
    if (open) group.inside += 1;
    groups.set(visit.geofenceId, group);
  });
  return [...groups.values()]
    .map(({ devices, ...group }) => ({
      ...group,
      vehicles: devices.size,
      average: group.visits ? group.total / group.visits : 0,
    }))
    .sort((a, b) => b.total - a.total);
};
