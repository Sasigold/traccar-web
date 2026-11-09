import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

import {
  altitudeFromMeters,
  altitudeUnitString,
  distanceFromMeters,
  distanceUnitString,
  speedFromKnots,
  speedUnitString,
  volumeFromLiters,
  volumeUnitString,
} from './converter';
import { prefixString } from './stringUtils';

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

export const formatBoolean = (value, t) => (value ? t('sharedYes') : t('sharedNo'));

export const formatNumber = (value, precision = 1) => Number(value.toFixed(precision));

export const formatPercentage = (value) => `${value}%`;

export const formatTemperature = (value) => `${value.toFixed(1)}°C`;

export const formatVoltage = (value, t) => `${value.toFixed(2)} ${t('sharedVoltAbbreviation')}`;

export const formatEnergy = (value, t) =>
  `${value.toFixed(2)} ${t('sharedKilowattHourAbbreviation')}`;

export const formatConsumption = (value, t) =>
  `${value.toFixed(2)} ${t('sharedLiterPerHourAbbreviation')}`;

// Dates, times and numbers follow the app language, not the browser: many Israeli users run an
// English OS, which used to turn the Hebrew UI into 11/08/2026, 10:28 PM. The locale is set by
// LocalizationProvider; Intl formatters are cached because markers format on every frame.
let formatLocale = 'he-IL-u-nu-latn';
const formatterCache = new Map();

export const setFormatLanguage = (language) => {
  const candidate = `${language || 'he'}-IL-u-nu-latn`;
  const next = Intl.DateTimeFormat.supportedLocalesOf([candidate]).length
    ? candidate
    : 'he-IL-u-nu-latn';
  if (next !== formatLocale) {
    formatLocale = next;
    formatterCache.clear();
  }
};

export const getFormatLocale = () => formatLocale;

const cached = (kind, options) => {
  const key = `${kind}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter =
      kind === 'date'
        ? new Intl.DateTimeFormat(formatLocale, options)
        : new Intl.NumberFormat(formatLocale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
};

const dateConfig = { year: 'numeric', month: '2-digit', day: '2-digit' };
const minuteConfig = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const secondConfig = { ...minuteConfig, second: '2-digit' };

// Grouped number with up to `digits` decimals (12,000 / 142.8).
export const formatGrouped = (value, digits = 1) =>
  cached('number', { maximumFractionDigits: digits }).format(value);

// Date and time are joined by a space only: a comma between two number runs is what scrambled
// the order in right-to-left text.
export const formatTime = (value, format) => {
  if (value) {
    const d = dayjs(value).toDate();
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    switch (format) {
      case 'date':
        return cached('date', dateConfig).format(d);
      case 'time':
        return cached('date', secondConfig).format(d);
      case 'clock':
        return cached('date', minuteConfig).format(d);
      case 'minutes':
        return `${cached('date', dateConfig).format(d)} ${cached('date', minuteConfig).format(d)}`;
      default:
        return `${cached('date', dateConfig).format(d)} ${cached('date', secondConfig).format(d)}`;
    }
  }
  return '';
};

// "8 בנוב׳ 2026" style label for periods and headings.
export const formatLongDate = (value) =>
  value
    ? cached('date', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
    : '';

export const formatStatus = (value, t) => t(prefixString('deviceStatus', value));

export const formatAlarm = (value, t) => {
  if (value) {
    return value
      .split(',')
      .map((alarm) => t(prefixString('alarm', alarm)))
      .join(', ');
  }
  return '';
};

export const formatCourse = (value) => {
  const courseValues = [
    '\u2191',
    '\u2197',
    '\u2192',
    '\u2198',
    '\u2193',
    '\u2199',
    '\u2190',
    '\u2196',
  ];
  let normalizedValue = (value + 45 / 2) % 360;
  if (normalizedValue < 0) {
    normalizedValue += 360;
  }
  return courseValues[Math.floor(normalizedValue / 45)];
};

export const formatDistance = (value, unit, t) =>
  `${formatGrouped(distanceFromMeters(value, unit), 1)} ${distanceUnitString(unit, t)}`;

export const formatAltitude = (value, unit, t) =>
  `${formatGrouped(altitudeFromMeters(value, unit), 0)} ${altitudeUnitString(unit, t)}`;

export const formatSpeed = (value, unit, t) =>
  `${formatGrouped(speedFromKnots(value, unit), 0)} ${speedUnitString(unit, t)}`;

export const formatVolume = (value, unit, t) =>
  `${formatGrouped(volumeFromLiters(value, unit), 1)} ${volumeUnitString(unit, t)}`;

export const formatNumericHours = (value, t) => {
  const hours = Math.floor(value / 3600000);
  const minutes = Math.floor((value % 3600000) / 60000);
  return `${hours} ${t('sharedHourAbbreviation')} ${minutes} ${t('sharedMinuteAbbreviation')}`;
};

export const formatCoordinate = (key, value, unit) => {
  let hemisphere;
  let degrees;
  let minutes;
  let seconds;

  if (key === 'latitude') {
    hemisphere = value >= 0 ? 'N' : 'S';
  } else {
    hemisphere = value >= 0 ? 'E' : 'W';
  }

  switch (unit) {
    case 'ddm': {
      const totalMinuteThousandths = Math.round(Math.abs(value) * 60000);
      degrees = Math.floor(totalMinuteThousandths / 60000);
      minutes = (totalMinuteThousandths % 60000) / 1000;
      return `${degrees}° ${minutes.toFixed(3)}' ${hemisphere}`;
    }
    case 'dms': {
      const totalSeconds = Math.round(Math.abs(value) * 3600);
      degrees = Math.floor(totalSeconds / 3600);
      minutes = Math.floor((totalSeconds % 3600) / 60);
      seconds = totalSeconds % 60;
      return `${degrees}° ${minutes}' ${seconds}" ${hemisphere}`;
    }
    default:
      return `${value.toFixed(5)}°`;
  }
};

export const formatAddress = (position, unit) => {
  if (position.address) {
    return position.address;
  }
  const formattedLatitude = formatCoordinate('latitude', position.latitude, unit);
  const formattedLongitude = formatCoordinate('longitude', position.longitude, unit);
  return `${formattedLatitude}, ${formattedLongitude}`;
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'online':
      return 'success';
    case 'offline':
      return 'error';
    case 'unknown':
    default:
      return 'neutral';
  }
};

export const getBatteryStatus = (batteryLevel) => {
  if (batteryLevel >= 70) {
    return 'success';
  }
  if (batteryLevel > 30) {
    return 'warning';
  }
  return 'error';
};

export const formatNotificationTitle = (t, notification, includeId) => {
  if (notification.description) {
    return notification.description;
  }
  let title = t(prefixString('event', notification.type));
  if (notification.type === 'alarm') {
    const alarmString = notification.attributes.alarms;
    if (alarmString) {
      const alarms = alarmString.split(',');
      if (alarms.length > 1) {
        title += ` (${alarms.length})`;
      } else {
        title += ` ${formatAlarm(alarms[0], t)}`;
      }
    }
  }
  if (includeId) {
    title += ` [${notification.id}]`;
  }
  return title;
};
