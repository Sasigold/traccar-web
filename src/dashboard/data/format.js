import { distanceFromMeters, speedFromKnots, volumeFromLiters } from '../../common/util/converter';

// Number display for dashboard figures. Pure.

// Raw value → number in the user's units (duration becomes hours).
export const toDisplay = (value, unit, prefs = {}) => {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }
  switch (unit) {
    case 'distance':
      return distanceFromMeters(value, prefs.distanceUnit);
    case 'speed':
      return speedFromKnots(value, prefs.speedUnit);
    case 'volume':
      return volumeFromLiters(value, prefs.volumeUnit);
    case 'duration':
      return value / 3600000;
    default:
      return Number(value);
  }
};

const decimalsFor = (value, unit) => {
  const magnitude = Math.abs(value);
  if (unit === 'count' || unit === 'money') {
    return 0;
  }
  if (unit === 'percent' || unit === 'score') {
    return magnitude < 10 && magnitude % 1 !== 0 ? 1 : 0;
  }
  return magnitude >= 100 ? 0 : 1;
};

// 1,284 · 12.9K · 4.2M. Values under 10,000 stay in full.
export const formatNumber = (value, unit, locale = 'en', { compact = true } = {}) => {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  const number = Number(value);
  if (compact && Math.abs(number) >= 10000) {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
      number,
    );
  }
  const decimals = decimalsFor(number, unit);
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(number);
};

// Hours as "H:MM" for durations shown in tables and tooltips.
export const formatHours = (hours) => {
  if (hours == null || Number.isNaN(hours)) {
    return '—';
  }
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

export const formatDelta = (value, locale = 'en') => {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    Math.abs(rounded),
  );
  if (rounded === 0) {
    return '0%';
  }
  return `${rounded > 0 ? '+' : '−'}${text}%`;
};
