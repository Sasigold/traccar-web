// SAF-04: what the insurer needs around a collision: the 60 seconds before and after, at the
// resolution the device sent, with the speed, heading and acceleration at the moment of impact.
export const ACCIDENT_WINDOW = 60000;

// positions: [{ fixTime, speed (knots), course, attributes }] sorted by time.
export const accidentWindow = (positions, at, window = ACCIDENT_WINDOW) => {
  const moment = Date.parse(at);
  const rows = positions
    .filter((p) => Math.abs(Date.parse(p.fixTime) - moment) <= window)
    .map((p) => ({
      offset: Math.round((Date.parse(p.fixTime) - moment) / 1000),
      speedKmh: Math.round((Number(p.speed) || 0) * 1.852),
      course: Math.round(Number(p.course) || 0),
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  const before = rows.filter((row) => row.offset <= 0);
  const impact = before[before.length - 1] || rows[0] || null;
  const maxBefore = before.reduce((max, row) => Math.max(max, row.speedKmh), 0);
  // The steepest drop in speed between consecutive points: a proxy for deceleration (km/h per s).
  let decel = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const dt = rows[i].offset - rows[i - 1].offset;
    if (dt > 0) decel = Math.max(decel, (rows[i - 1].speedKmh - rows[i].speedKmh) / dt);
  }
  return { rows, impact, maxSpeedBefore: maxBefore, maxDeceleration: Math.round(decel * 10) / 10 };
};
