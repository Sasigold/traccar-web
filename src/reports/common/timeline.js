// The daily timeline (REP-23): for each vehicle, what it did across the day. Driving (trips),
// idling (engine on while stopped), parked (the rest of a stop) and no data (gaps nothing covers).
// Pure, unit-tested.

const MINUTE = 60 * 1000;

const clip = (start, end, from, to) => {
  const s = Math.max(start, from);
  const e = Math.min(end, to);
  return e > s ? [s, e] : null;
};

// Rows of one vehicle → segments sorted by time, clipped to [from, to), with gaps as no data
// (up to `now`: the rest of today is not "no data" yet).
export const vehicleTimeline = (trips, stops, from, to, now = Date.now()) => {
  const segments = [];
  trips.forEach((trip) => {
    const range = clip(Date.parse(trip.startTime), Date.parse(trip.endTime), from, to);
    if (range) {
      segments.push({ type: 'driving', start: range[0], end: range[1], row: trip });
    }
  });
  stops.forEach((stop) => {
    const start = Date.parse(stop.startTime);
    const end = Date.parse(stop.endTime);
    // Traccar gives the engine time of a stop, not when it was; idling usually comes first
    // (warming up, waiting), so it is drawn at the start of the stop.
    const idle = Math.min(Number(stop.engineHours) || 0, end - start);
    const idleRange = idle > 0 ? clip(start, start + idle, from, to) : null;
    if (idleRange) {
      segments.push({ type: 'idle', start: idleRange[0], end: idleRange[1], row: stop });
    }
    const parked = clip(start + idle, end, from, to);
    if (parked) {
      segments.push({ type: 'parked', start: parked[0], end: parked[1], row: stop });
    }
  });
  segments.sort((a, b) => a.start - b.start);

  // Gaps longer than a few minutes are shown as "no data" (the device was off or silent).
  const result = [];
  let cursor = from;
  segments.forEach((segment) => {
    if (segment.start - cursor > 5 * MINUTE) {
      result.push({ type: 'nodata', start: cursor, end: segment.start });
    }
    result.push(segment);
    cursor = Math.max(cursor, segment.end);
  });
  if (to - cursor > 5 * MINUTE && result.length) {
    result.push({ type: 'nodata', start: cursor, end: Math.min(to, now) });
  }
  return result.filter((segment) => segment.end > segment.start);
};

// Totals per vehicle for the side column and the screen-reader table.
export const timelineTotals = (segments) => {
  const totals = { driving: 0, idle: 0, parked: 0, nodata: 0 };
  segments.forEach((segment) => {
    totals[segment.type] += segment.end - segment.start;
  });
  const driving = segments.filter((segment) => segment.type === 'driving');
  return {
    ...totals,
    firstStart: driving.length ? driving[0].start : null,
    lastEnd: driving.length ? driving[driving.length - 1].end : null,
    trips: driving.length,
  };
};

// Every vehicle's timeline for the day, most active first.
export const buildTimeline = (devices, trips, stops, from, to, now = Date.now()) =>
  devices
    .map((device) => {
      const segments = vehicleTimeline(
        trips.filter((row) => row.deviceId === device.id),
        stops.filter((row) => row.deviceId === device.id),
        from,
        to,
        now,
      );
      return { device, segments, totals: timelineTotals(segments) };
    })
    .sort(
      (a, b) => b.totals.driving - a.totals.driving || a.device.name.localeCompare(b.device.name),
    );
