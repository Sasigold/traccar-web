// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// Customer visits from Traccar geofence events (pure, tested).

// events: Traccar events of type geofenceEnter / geofenceExit (any order).
// Returns visits { deviceId, geofenceId, arrived, left, minutes }, newest first. A visit still
// in progress has left = null; an exit without an enter in the range starts at null.
export const pairVisits = (events, now = new Date()) => {
  const sorted = [...events].sort((a, b) => new Date(a.eventTime) - new Date(b.eventTime));
  const open = new Map();
  const visits = [];
  const minutes = (from, to) => Math.round((new Date(to) - new Date(from)) / 60000);

  sorted.forEach((event) => {
    const key = `${event.deviceId}:${event.geofenceId}`;
    if (event.type === 'geofenceEnter') {
      if (!open.has(key)) {
        open.set(key, event.eventTime);
      }
    } else if (event.type === 'geofenceExit') {
      const arrived = open.get(key) || null;
      open.delete(key);
      visits.push({
        deviceId: event.deviceId,
        geofenceId: event.geofenceId,
        arrived,
        left: event.eventTime,
        minutes: arrived ? minutes(arrived, event.eventTime) : null,
      });
    }
  });

  open.forEach((arrived, key) => {
    const [deviceId, geofenceId] = key.split(':').map(Number);
    visits.push({ deviceId, geofenceId, arrived, left: null, minutes: minutes(arrived, now) });
  });

  return visits.sort((a, b) => new Date(b.arrived || b.left) - new Date(a.arrived || a.left));
};

// Totals per point: visit count and total minutes.
export const visitTotals = (visits) => {
  const totals = new Map();
  visits.forEach((visit) => {
    const total = totals.get(visit.geofenceId) || { count: 0, minutes: 0 };
    total.count += 1;
    total.minutes += visit.minutes || 0;
    totals.set(visit.geofenceId, total);
  });
  return totals;
};

export const circleArea = (latitude, longitude, radius) =>
  `CIRCLE (${Number(latitude)} ${Number(longitude)}, ${Math.round(Number(radius))})`;
