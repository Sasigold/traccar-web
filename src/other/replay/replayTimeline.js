// LIV-10: the replay timeline by time, not by point. Pure, unit-tested.

export const GAP_MS = 5 * 60 * 1000; // no fix for this long: the line is broken (no signal / off)
export const MOVING_KNOTS = 2; // slower than this is standing
export const STOP_MS = 2 * 60 * 1000; // a stop worth listing
export const SPEEDS = [1, 5, 20, 60];

const timeOf = (position) => new Date(position.fixTime).getTime();

// The route in parts: driving, standing, and gaps with no fix. Neighbouring parts of the same
// kind join into one.
export const timelineSegments = (positions, { gap = GAP_MS, moving = MOVING_KNOTS } = {}) => {
  const segments = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const start = timeOf(positions[i]);
    const end = timeOf(positions[i + 1]);
    let type;
    if (end - start > gap) {
      type = 'gap';
    } else if ((positions[i + 1].speed || 0) >= moving || (positions[i].speed || 0) >= moving) {
      type = 'moving';
    } else {
      type = 'stopped';
    }
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      last.end = end;
      last.toIndex = i + 1;
    } else {
      segments.push({ type, start, end, fromIndex: i, toIndex: i + 1 });
    }
  }
  return segments;
};

// The stops to jump to: standing or no fix for at least `minimum`.
export const replayStops = (segments, { minimum = STOP_MS } = {}) =>
  segments
    .filter((segment) => segment.type !== 'moving' && segment.end - segment.start >= minimum)
    .map((segment) => ({
      index: segment.fromIndex,
      start: segment.start,
      end: segment.end,
      duration: segment.end - segment.start,
    }));

// The last point at or before `time` (the first point before the start).
export const indexAtTime = (positions, time) => {
  let low = 0;
  let high = positions.length - 1;
  if (high < 0) return 0;
  if (time <= timeOf(positions[0])) return 0;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (timeOf(positions[middle]) <= time) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
};

// A step of `ms` along the time line from the point at `index` (at least one point).
export const stepByTime = (positions, index, ms) => {
  if (!positions.length) return 0;
  const target = indexAtTime(positions, timeOf(positions[index]) + ms);
  if (ms > 0) return Math.min(positions.length - 1, Math.max(target, index + 1));
  return Math.max(0, Math.min(target, index - 1));
};

// The quick periods offered above the filter.
export const quickRange = (key, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (key) {
    case 'yesterday':
      return {
        period: 'yesterday',
        from: new Date(start.getTime() - 86400000),
        to: new Date(start.getTime() - 1),
      };
    case 'last24':
      return { period: 'custom', from: new Date(now.getTime() - 86400000), to: now };
    default:
      return { period: 'today', from: start, to: now };
  }
};
