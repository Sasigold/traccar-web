// LIV-12: the selected vehicle's last minutes as a trail: points newer than the window, in
// time order, without repeats; a new live position is appended. Pure, tested.

export const TRAIL_MINUTES = 10;

export const trailPoints = (positions, now = Date.now(), minutes = TRAIL_MINUTES) => {
  const since = now - minutes * 60000;
  const points = [];
  [...positions]
    .filter((position) => new Date(position.fixTime).getTime() >= since)
    .sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
    .forEach((position) => {
      const last = points.at(-1);
      if (!last || last.longitude !== position.longitude || last.latitude !== position.latitude) {
        points.push(position);
      }
    });
  return points;
};
