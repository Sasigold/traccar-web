// LIV-24: handling alerts: the state of a case, the response-time target (SLA) and the report.

export const DEFAULT_SLA_MINUTES = 15;
export const CASE_STATUSES = ['new', 'in_progress', 'closed'];

const minutesBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 60000;

// What the countdown chip says about an alert: still time to respond, late, or handled.
export const slaState = (
  occurredAt,
  status = 'new',
  slaMinutes = DEFAULT_SLA_MINUTES,
  now = Date.now(),
) => {
  if (status !== 'new') return { kind: 'handled', minutes: 0 };
  const left = slaMinutes - (now - Date.parse(occurredAt)) / 60000;
  if (!Number.isFinite(left)) return { kind: 'handled', minutes: 0 };
  return left >= 0
    ? { kind: 'due', minutes: Math.max(0, Math.floor(left)) }
    : { kind: 'late', minutes: Math.ceil(-left) };
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// The response-time report: how many alerts, how many were taken, the median minutes to take
// one, the share taken within the target, and the same per person who took them.
export const responseStats = (cases, slaMinutes = DEFAULT_SLA_MINUTES) => {
  const taken = cases.filter((item) => item.taken_at);
  const minutes = taken.map((item) => Math.max(0, minutesBetween(item.occurred_at, item.taken_at)));
  const byPerson = new Map();
  taken.forEach((item, index) => {
    const key = item.taken_by || 'unknown';
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key).push(minutes[index]);
  });
  return {
    total: cases.length,
    taken: taken.length,
    open: cases.filter((item) => item.status !== 'closed').length,
    medianMinutes: median(minutes),
    withinSla: taken.length
      ? minutes.filter((value) => value <= slaMinutes).length / taken.length
      : null,
    people: [...byPerson.entries()]
      .map(([id, values]) => ({
        id,
        count: values.length,
        medianMinutes: median(values),
        withinSla: values.filter((value) => value <= slaMinutes).length / values.length,
      }))
      .sort((a, b) => b.count - a.count),
  };
};

// The row written when someone changes an alert's status.
export const caseRow = (event, orgId, status, assignedTo) => ({
  org_id: orgId,
  traccar_event_id: event.id,
  traccar_device_id: event.deviceId,
  event_type: event.type,
  occurred_at: event.eventTime,
  status,
  assigned_to: assignedTo || null,
});
