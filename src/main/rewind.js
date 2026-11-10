// LIV-26: the whole fleet at a moment in the past. Pure, tested.

export const LOOKBACK_MINUTES = 30;
export const RANGE_HOURS = 24;
export const STEP_MINUTES = 5;

// The window to ask for: a short stretch before the moment, so a vehicle that reported a little
// earlier is still placed where it was.
export const rewindWindow = (time, lookback = LOOKBACK_MINUTES) => ({
  from: new Date(time - lookback * 60000).toISOString(),
  to: new Date(time).toISOString(),
});

// Each vehicle's last position at or before the moment, from a list of positions.
export const positionsAt = (history, time) => {
  const latest = new Map();
  history.forEach((position) => {
    const at = new Date(position.fixTime).getTime();
    if (!(at <= time)) return;
    const current = latest.get(position.deviceId);
    if (!current || at > new Date(current.fixTime).getTime())
      latest.set(position.deviceId, position);
  });
  return [...latest.values()];
};

// The slider's value is minutes back from now (0 = live); this is the moment, on a 5-minute step.
export const momentOf = (minutesBack, now = Date.now()) => {
  const step = STEP_MINUTES * 60000;
  return Math.floor((now - minutesBack * 60000) / step) * step;
};
