// REP-09: a report compared with the period before it (the same length, right before).

export const previousRange = (from, to) => {
  const start = Date.parse(from);
  const end = Date.parse(to);
  const length = end - start;
  return {
    from: new Date(start - length - 1).toISOString(),
    to: new Date(start - 1).toISOString(),
  };
};

// The change from the previous value: up, down or the same, and by how many percent. Nothing
// to compare with (no previous value, or zero before) gives null.
export const delta = (current, previous) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const percent = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return {
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'same',
    percent: Math.abs(percent),
  };
};

export const formatDelta = (change) =>
  change ? `${{ up: '▲', down: '▼', same: '=' }[change.direction]} ${change.percent}%` : '';
