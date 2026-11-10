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

// SAF-04: the track around the impact as a sketch to print (no map tiles): the points projected
// on a local plane and fitted into width × height, with a round scale bar. Pure, tested.
const METERS_PER_DEGREE = 111320;
const NICE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

export const trackSketch = (rows, width, height, pad = 16) => {
  const located = rows.filter((row) => row.latitude != null && row.longitude != null);
  if (located.length < 2) return null;
  const lat0 = located.reduce((sum, row) => sum + row.latitude, 0) / located.length;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  // Meters east and north of the first point.
  const plane = located.map((row) => ({
    row,
    x: (row.longitude - located[0].longitude) * cos * METERS_PER_DEGREE,
    y: (row.latitude - located[0].latitude) * METERS_PER_DEGREE,
  }));
  const xs = plane.map((p) => p.x);
  const ys = plane.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offsetX = pad + (width - 2 * pad - spanX * scale) / 2;
  const offsetY = pad + (height - 2 * pad - spanY * scale) / 2;
  const points = plane.map((p) => ({
    row: p.row,
    x: offsetX + (p.x - Math.min(...xs)) * scale,
    // North is up.
    y: offsetY + (Math.max(...ys) - p.y) * scale,
  }));
  const meters = NICE.find((value) => value * scale >= width / 6) || NICE[NICE.length - 1];
  return { points, scaleMeters: meters, scalePixels: meters * scale };
};
