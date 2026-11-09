// Employee location privacy (ISR-03): when a vehicle's location is hidden, and hiding it.
// A location is hidden outside the organization's working hours (when the policy says so) and
// while the driver's "private" switch is on. Pure functions, unit-tested.

export const DEFAULT_POLICY = {
  hide_outside_hours: false,
  work_days: [0, 1, 2, 3, 4],
  work_start: '07:00',
  work_end: '19:00',
  timezone: 'Asia/Jerusalem',
  allow_private_switch: true,
  retention_days: null,
  view_log_days: 730,
};

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map();

// Day of week (0 = Sunday) and minutes since midnight in the policy's time zone.
export const localParts = (time, timezone = DEFAULT_POLICY.timezone) => {
  if (!formatters.has(timezone)) {
    formatters.set(
      timezone,
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    );
  }
  const parts = Object.fromEntries(
    formatters
      .get(timezone)
      .formatToParts(new Date(time))
      .map((part) => [part.type, part.value]),
  );
  return { day: WEEKDAYS[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

export const clockMinutes = (value) => {
  const [hours, minutes] = String(value || '0:0').split(':');
  return Number(hours) * 60 + Number(minutes || 0);
};

// Inside working hours? A shift that ends after midnight (22:00–06:00) belongs to the day it starts.
export const isWorkTime = (policy, time) => {
  const { day, minutes } = localParts(time, policy.timezone || DEFAULT_POLICY.timezone);
  const start = clockMinutes(policy.work_start);
  const end = clockMinutes(policy.work_end);
  const days = policy.work_days || [];
  if (start === end) {
    return days.includes(day);
  }
  if (start < end) {
    return days.includes(day) && minutes >= start && minutes < end;
  }
  return (
    (days.includes(day) && minutes >= start) || (days.includes((day + 6) % 7) && minutes < end)
  );
};

export const inPrivatePeriod = (periods, deviceId, time) => {
  const moment = new Date(time).getTime();
  return (periods || []).some(
    (period) =>
      period.traccar_device_id === deviceId &&
      Date.parse(period.started_at) <= moment &&
      (!period.ended_at || moment < Date.parse(period.ended_at)),
  );
};

// Why a location is hidden: 'private' (the driver's switch), 'hours' (outside working hours) or null.
export const hiddenReason = (privacy, deviceId, time) => {
  if (!privacy || time == null) {
    return null;
  }
  if (inPrivatePeriod(privacy.periods, deviceId, time)) {
    return 'private';
  }
  if (privacy.policy?.hide_outside_hours && !isWorkTime(privacy.policy, time)) {
    return 'hours';
  }
  return null;
};

export const isPrivacyActive = (privacy) =>
  Boolean(privacy && (privacy.policy?.hide_outside_hours || privacy.periods?.length));

// Positions with the hidden ones taken out; what was hidden is counted and its distance kept.
export const maskPositions = (positions, privacy) => {
  if (!isPrivacyActive(privacy)) {
    return { positions, hidden: 0, hiddenDistance: 0 };
  }
  let hidden = 0;
  let hiddenDistance = 0;
  const visible = positions.filter((position) => {
    if (hiddenReason(privacy, position.deviceId, position.fixTime)) {
      hidden += 1;
      hiddenDistance += Number(position.attributes?.distance) || 0;
      return false;
    }
    return true;
  });
  return { positions: hidden ? visible : positions, hidden, hiddenDistance };
};

const PLACE_FIELDS = [
  'startAddress',
  'endAddress',
  'address',
  'startLat',
  'startLon',
  'endLat',
  'endLon',
  'latitude',
  'longitude',
];

export const isPlaceField = (key) => PLACE_FIELDS.includes(key);

// A report row (trip, stop, event) that starts or ends in hidden time keeps its times and
// distance but loses every place: addresses and coordinates.
export const maskReportRow = (row, privacy, times = ['startTime', 'endTime']) => {
  if (!isPrivacyActive(privacy)) {
    return row;
  }
  const reason = times.map((key) => hiddenReason(privacy, row.deviceId, row[key])).find(Boolean);
  if (!reason) {
    return row;
  }
  const masked = { ...row, privacy: reason };
  PLACE_FIELDS.forEach((key) => {
    if (key in masked) {
      masked[key] = null;
    }
  });
  return masked;
};

// Does [from, to] touch hidden time for this vehicle? Used where the data has no times of its
// own (the combined report's route line). Working hours are checked every 15 minutes.
export const rangeTouchesHidden = (privacy, deviceId, from, to) => {
  if (!isPrivacyActive(privacy)) {
    return false;
  }
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const inPeriod = (privacy.periods || []).some(
    (period) =>
      period.traccar_device_id === deviceId &&
      Date.parse(period.started_at) < end &&
      (!period.ended_at || Date.parse(period.ended_at) > start),
  );
  if (inPeriod) {
    return true;
  }
  if (!privacy.policy?.hide_outside_hours) {
    return false;
  }
  const step = 15 * 60 * 1000;
  for (let time = start; time < end; time += step) {
    if (!isWorkTime(privacy.policy, time)) {
      return true;
    }
  }
  return !isWorkTime(privacy.policy, end);
};
