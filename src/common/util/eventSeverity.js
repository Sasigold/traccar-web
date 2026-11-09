// How loudly an event asks for attention.
//
// critical: someone may be in danger or the vehicle is being tampered with. A banner stays at the
//           top of every screen, is read out at once and sounds, until someone acknowledges it.
// warning:  needs a look soon (other alarms, speeding, fuel drop, maintenance due, driver
//           messages). A notice for 6 seconds.
// info:     everything else; only the bell count goes up.
//
// The user's sound preferences (alarm types and event types that sound) are critical too.

export const CRITICAL_ALARMS = [
  'sos',
  'accident',
  'fallDown',
  'tampering',
  'powerCut',
  'jamming',
  'tow',
];

const WARNING_TYPES = new Set([
  'alarm',
  'deviceOverspeed',
  'deviceFuelDrop',
  'maintenance',
  'textMessage',
]);

const listOf = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const eventSeverity = (event, { soundAlarms = '', soundEvents = '' } = {}) => {
  if (!event) {
    return 'info';
  }
  const criticalAlarms = new Set([...CRITICAL_ALARMS, ...listOf(soundAlarms)]);
  if (
    event.type === 'alarm' &&
    listOf(event.attributes?.alarm).some((a) => criticalAlarms.has(a))
  ) {
    return 'critical';
  }
  if (listOf(soundEvents).includes(event.type)) {
    return 'critical';
  }
  return WARNING_TYPES.has(event.type) ? 'warning' : 'info';
};

export const eventTime = (event) => {
  const time = Date.parse(event?.eventTime);
  return Number.isFinite(time) ? time : 0;
};

// Events newer than the last time the list was opened.
export const unreadCount = (events, lastSeen) =>
  events.filter((event) => eventTime(event) > (lastSeen || 0)).length;
