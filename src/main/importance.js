import { activityOf } from '../common/util/activity';

// LIV-11: "important first", the list's default order: an alarm, speeding, a vehicle that went
// silent in the last hour, idling, driving, standing, and long offline last. Pure, unit-tested.
const HOUR = 3600000;

export const importanceRank = (device, position, now = Date.now()) => {
  if (position?.attributes?.alarm) return 0;
  const limit = Number(device?.attributes?.speedLimit) || 0; // knots, as Traccar keeps it
  if (limit > 0 && position && position.speed > limit) return 1;
  const activity = activityOf(device, position, now);
  if (activity === 'offline' || activity === 'stale') {
    const last = Date.parse(device?.lastUpdate || position?.fixTime || '');
    return Number.isFinite(last) && now - last < HOUR ? 2 : 6;
  }
  if (activity === 'idling') return 3;
  if (activity === 'moving') return 4;
  return 5;
};

export const byImportance =
  (positions, now = Date.now()) =>
  (a, b) =>
    importanceRank(a, positions[a.id], now) - importanceRank(b, positions[b.id], now) ||
    a.name.localeCompare(b.name);
