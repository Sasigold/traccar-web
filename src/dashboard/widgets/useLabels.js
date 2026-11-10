// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { useAttributePreference } from '../../common/util/preferences';
import { prefixString } from '../../common/util/stringUtils';
import { distanceUnitString, speedUnitString, volumeUnitString } from '../../common/util/converter';
import { BATTERY_BANDS, DIMENSIONS, FUEL_BANDS, SPEED_BANDS, labelKeyOf } from '../data/datasets';
import { OTHER } from '../data/aggregate';
import { formatHours, formatNumber, toDisplay } from '../data/format';

const bandLabels = (limits, suffix) => [
  `< ${limits[0]}${suffix}`,
  ...limits.slice(1).map((limit, index) => `${limits[index]}–${limit}${suffix}`),
  `${limits.at(-1)}${suffix}+`,
];

// Labels for dimension values and display formatting for measure values, in the
// user's language and units.
export const useLabels = () => {
  const t = useTranslation();
  const { language } = useLocalization();
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items);
  const drivers = useSelector((state) => state.drivers.items);
  const distanceUnit = useAttributePreference('distanceUnit');
  const speedUnit = useAttributePreference('speedUnit', 'kmh');
  const volumeUnit = useAttributePreference('volumeUnit');
  const prefs = useMemo(
    () => ({ distanceUnit, speedUnit, volumeUnit }),
    [distanceUnit, speedUnit, volumeUnit],
  );

  const speedBands = useMemo(
    () => bandLabels(SPEED_BANDS[speedUnit] ?? SPEED_BANDS.kmh, ''),
    [speedUnit],
  );

  const label = useCallback(
    (dimensionKey, value, bucket) => {
      if (value === OTHER) {
        return t('dashboardOther');
      }
      const dimension = DIMENSIONS[dimensionKey];
      if (!dimension) {
        return String(value);
      }
      if (dimension.type === 'time') {
        const time = dayjs(value);
        switch (dimension.bucket ?? bucket) {
          case 'hour':
            return time.format('HH:00');
          case 'month':
            return time.format('MMM YY');
          case 'week':
            return time.format('D/M');
          default:
            return time.format('D/M');
        }
      }
      if (dimension.labelPrefix) {
        const key = labelKeyOf(dimension.labelPrefix, value);
        const text = t(key);
        return text && text !== key ? text : String(value);
      }
      switch (dimension.ref) {
        case 'device':
          return devices[value]?.name ?? (value == null ? '—' : `#${value}`);
        case 'group':
          return value ? (groups[value]?.name ?? `#${value}`) : t('dashboardNoGroup');
        case 'driver':
          return drivers[value]?.name ?? String(value);
        case 'eventType':
          if (String(value).startsWith('alarm:')) {
            return t(prefixString('alarm', String(value).slice(6))) || String(value);
          }
          return t(prefixString('event', value)) || String(value);
        case 'hour':
          return `${String(value).padStart(2, '0')}:00`;
        case 'weekday':
          return dayjs().day(value).format('ddd');
        case 'speedBand':
          return `${speedBands[Number(String(value).slice(1))]} ${speedUnitString(speedUnit, t)}`;
        case 'fuelBand':
          return bandLabels(FUEL_BANDS, '%')[Number(String(value).slice(1))];
        case 'batteryBand':
          return bandLabels(BATTERY_BANDS, '%')[Number(String(value).slice(1))];
        default:
          return String(value);
      }
    },
    [t, devices, groups, drivers, speedBands, speedUnit],
  );

  const unitLabel = useCallback(
    (unit) => {
      switch (unit) {
        case 'distance':
          return distanceUnitString(distanceUnit, t);
        case 'speed':
          return speedUnitString(speedUnit, t);
        case 'volume':
          return volumeUnitString(volumeUnit, t);
        case 'duration':
          return t('sharedHourAbbreviation');
        case 'percent':
          return '%';
        case 'money':
          return '₪';
        case 'fuelRate':
          return t('dashboardUnitFuelRate');
        case 'mass':
          return t('dashboardUnitKg');
        default:
          return '';
      }
    },
    [t, distanceUnit, speedUnit, volumeUnit],
  );

  // Raw value → { number (display units), text (without unit), full (with unit) }
  const format = useCallback(
    (raw, unit, { compact = true } = {}) => {
      const number = toDisplay(raw, unit, prefs);
      if (number == null) {
        return { number: null, text: '—', full: '—' };
      }
      if (unit === 'money') {
        const text = `₪${formatNumber(number, unit, language, { compact })}`;
        return { number, text, full: text };
      }
      if (unit === 'duration' && !compact) {
        const text = formatHours(number);
        return { number, text, full: `${text} ${unitLabel(unit)}` };
      }
      const text = formatNumber(number, unit, language, { compact });
      const suffix = unitLabel(unit);
      let full = text;
      if (unit === 'percent') {
        full = `${text}%`;
      } else if (suffix) {
        full = `${text} ${suffix}`;
      }
      return { number, text, full };
    },
    [prefs, language, unitLabel],
  );

  // A number already in display units → text (money gets the shekel sign).
  const displayText = useCallback(
    (number, unit) => {
      if (number == null || Number.isNaN(number)) {
        return '—';
      }
      if (unit === 'money') {
        return `₪${formatNumber(number, unit, language)}`;
      }
      return formatNumber(number, unit, language);
    },
    [language],
  );

  return { t, label, format, displayText, unitLabel, prefs, language };
};
