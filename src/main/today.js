import { activityGroup, activityOf } from '../common/util/activity';

// LIV-23: the counts on "Today": moving, stopped (parked or idling) and offline (or stale).
export const todaySummary = (devices, positions, now = Date.now()) => {
  const summary = { total: 0, moving: 0, stopped: 0, offline: 0 };
  Object.values(devices || {})
    .filter((device) => !device.disabled)
    .forEach((device) => {
      summary.total += 1;
      summary[activityGroup(activityOf(device, positions?.[device.id], now))] += 1;
    });
  return summary;
};
