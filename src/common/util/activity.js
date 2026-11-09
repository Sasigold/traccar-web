import { formatDays } from './plural';

// What a vehicle is doing, for the live list, the KPI tiles and the card. Connection status alone
// ("online") doesn't answer the dispatcher's question: is it driving, standing, idling, or are we
// looking at old data?
//   moving   speed above walking pace or the device says it is in motion
//   idling   standing with the ignition on
//   stopped  standing with the ignition off (or unknown)
//   stale    the device is online but its last GPS fix is old
//   offline  the device is offline or never reported
export const STALE_AFTER_MS = 10 * 60 * 1000;
const MOVING_KNOTS = 1;

export const activityOf = (device, position, now = Date.now()) => {
  if (!device || device.status !== 'online' || !position) {
    return 'offline';
  }
  const fix = Date.parse(position.fixTime || position.deviceTime || '');
  if (Number.isFinite(fix) && now - fix > STALE_AFTER_MS) {
    return 'stale';
  }
  if (position.speed > MOVING_KNOTS || position.attributes?.motion === true) {
    return 'moving';
  }
  return position.attributes?.ignition === true ? 'idling' : 'stopped';
};

// The three groups the KPI tiles filter on.
export const activityGroup = (activity) => {
  if (activity === 'moving') return 'moving';
  if (activity === 'idling' || activity === 'stopped') return 'stopped';
  return 'offline';
};

// Since when the vehicle is in its current motion state: Traccar's device.motionTime when the
// state matches, otherwise unknown.
export const activitySince = (device, activity) => {
  if (
    !device?.motionTime ||
    (activity !== 'idling' && activity !== 'stopped' && activity !== 'moving')
  ) {
    return null;
  }
  const moving = activity === 'moving';
  if (device.motionState != null && Boolean(device.motionState) !== moving) {
    return null;
  }
  const time = Date.parse(device.motionTime);
  return Number.isFinite(time) ? time : null;
};

// "23 דק׳", "2:05 ש׳", "3 ימים": short durations for the list.
export const formatShortDuration = (ms, t) => {
  if (ms == null || ms < 0) {
    return '';
  }
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} ${t('sharedMinuteAbbreviation')}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')} ${t('sharedHourAbbreviation')}`;
  }
  return formatDays(Math.floor(hours / 24), t);
};
