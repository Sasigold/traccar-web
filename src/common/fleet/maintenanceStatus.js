// Maintenance status, computed from the vehicle's latest position.
//
// Traccar raises a `maintenance` event when the tracked value crosses `start`, then every
// `period` after it. We treat `start` as "the last service", so "mark as done" moves `start` to
// the current value and the next service falls at `start + period`. When the value is still
// below `start` (a first service planned ahead), the next service is `start` itself.

// Share of the period that counts as "due soon".
export const DUE_SOON_SHARE = 0.1;

export const isTimeType = (type) => Boolean(type?.endsWith('Time'));

// Current value of the tracked quantity, in Traccar raw units (meters, milliseconds, ...).
export const currentMaintenanceValue = (type, position, now = Date.now()) => {
  if (isTimeType(type)) {
    const value = position?.[type] ? Date.parse(position[type]) : NaN;
    return Number.isNaN(value) ? now : Math.max(value, now);
  }
  if (!position) {
    return null;
  }
  const value = Object.prototype.hasOwnProperty.call(position, type)
    ? position[type]
    : position.attributes?.[type];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

// { status: unknown | ok | due | overdue, current, next, remaining }
export const maintenanceStatus = (maintenance, position, now = Date.now()) => {
  const current = currentMaintenanceValue(maintenance.type, position, now);
  const { start = 0, period = 0 } = maintenance;
  if (current == null || !period) {
    return { status: 'unknown', current, next: null, remaining: null };
  }
  const next = current < start ? start : start + period;
  const remaining = next - current;
  let status = 'ok';
  if (remaining < 0) {
    status = 'overdue';
  } else if (remaining <= period * DUE_SOON_SHARE) {
    status = 'due';
  }
  return { status, current, next, remaining };
};

const rank = { overdue: 3, due: 2, ok: 1, unknown: 0 };

export const sortByUrgency = (rows) =>
  [...rows].sort(
    (a, b) =>
      rank[b.state.status] - rank[a.state.status] ||
      (a.state.remaining ?? Infinity) / (a.maintenance.period || 1) -
        (b.state.remaining ?? Infinity) / (b.maintenance.period || 1),
  );
