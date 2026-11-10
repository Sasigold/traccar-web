// AI-05: automation rules from templates: each reads as a sentence and is tested on the last week
// before it is turned on. Pure.

export const TEMPLATES = {
  afterHours: { source: 'trips', defaults: { after: '20:00', before: '06:00' } },
  overspeed: { source: 'events', defaults: { speed: 110 } },
  geofenceEnter: { source: 'events', defaults: { geofenceId: null } },
  criticalFault: { source: 'events', defaults: {} },
  idling: { source: 'stops', defaults: { minutes: 15 } },
};

export const ACTIONS = ['notify', 'workOrder', 'outOfService', 'messageDriver'];

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm || '0:0')
    .split(':')
    .map(Number);
  return h * 60 + (m || 0);
};
const localMinutes = (time) => {
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
};

// After a time in the evening, or before one in the morning (crossing midnight).
export const inNight = (time, after, before) => {
  const minutes = localMinutes(time);
  const from = minutesOf(after);
  const to = minutesOf(before);
  return from > to ? minutes >= from || minutes < to : minutes >= from && minutes < to;
};

const FAULT_ALARMS = ['fault', 'general', 'tow', 'accident', 'tampering', 'powerCut'];

// Whether one row (a trip, a stop or an event) fires the rule.
export const matches = (rule, row) => {
  const params = { ...TEMPLATES[rule.template]?.defaults, ...rule.params };
  switch (rule.template) {
    case 'afterHours':
      return inNight(row.startTime, params.after, params.before);
    case 'overspeed':
      return (
        row.type === 'deviceOverspeed' &&
        (Number(row.attributes?.speed) || 0) * 1.852 >= Number(params.speed)
      );
    case 'geofenceEnter':
      return (
        row.type === 'geofenceEnter' &&
        (!params.geofenceId || Number(row.geofenceId) === Number(params.geofenceId))
      );
    case 'criticalFault':
      return row.type === 'alarm' && FAULT_ALARMS.includes(row.attributes?.alarm);
    case 'idling':
      return (Number(row.engineHours) || 0) >= Number(params.minutes) * 60000;
    default:
      return false;
  }
};

// The test on the last week: the rows that would have fired, newest first.
export const backtest = (rule, rows) =>
  rows
    .filter((row) => matches(rule, row))
    .sort(
      (a, b) => Date.parse(b.eventTime || b.startTime) - Date.parse(a.eventTime || a.startTime),
    );

// The rule as a sentence: { key, values } to translate ("When a vehicle moves after {0}…").
export const sentence = (rule, names = {}) => {
  const params = { ...TEMPLATES[rule.template]?.defaults, ...rule.params };
  switch (rule.template) {
    case 'afterHours':
      return { key: 'autoSentenceAfterHours', values: [params.after, params.before] };
    case 'overspeed':
      return { key: 'autoSentenceOverspeed', values: [params.speed] };
    case 'geofenceEnter':
      return {
        key: params.geofenceId ? 'autoSentenceGeofence' : 'autoSentenceAnyGeofence',
        values: [names.geofence?.(params.geofenceId) || ''],
      };
    case 'criticalFault':
      return { key: 'autoSentenceFault', values: [] };
    case 'idling':
      return { key: 'autoSentenceIdling', values: [params.minutes] };
    default:
      return { key: 'autoSentenceUnknown', values: [] };
  }
};
