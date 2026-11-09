// Reconnect policy for the live socket: a quick first retry, then exponential back-off with
// jitter up to 30 s, so a short mobile drop costs about a second and a server restart doesn't
// make every client reconnect in the same instant.
export const MAX_RECONNECT_DELAY_MS = 30000;

export const reconnectDelay = (attempt, random = Math.random) => {
  const base = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.max(0, attempt));
  const jitter = base * 0.2 * (random() * 2 - 1);
  return Math.round(Math.min(MAX_RECONNECT_DELAY_MS, Math.max(500, base + jitter)));
};

// Events raised while the socket was down are fetched from the events report afterwards.
// Short gaps are covered by the REST refresh; very long ones would be a flood of old alarms.
export const MIN_BACKFILL_GAP_MS = 5000;
export const MAX_BACKFILL_GAP_MS = 6 * 3600 * 1000;

export const backfillRange = (lastMessageAt, now = Date.now()) => {
  if (!lastMessageAt) {
    return null;
  }
  const gap = now - lastMessageAt;
  if (gap < MIN_BACKFILL_GAP_MS) {
    return null;
  }
  const from = Math.max(lastMessageAt, now - MAX_BACKFILL_GAP_MS);
  return { from: new Date(from).toISOString(), to: new Date(now).toISOString() };
};
