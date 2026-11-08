import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

// Value formats shared by every picker. They match what the native inputs used to emit, so the
// pickers are drop-in replacements: forms keep storing the same strings.
export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm';
export const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_RE = /(?:^|T)(\d{2}):(\d{2})/;

// Parses 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm' or 'HH:mm' (against `base`) in local time.
// Returns null for empty or malformed input instead of an invalid dayjs.
export const parseValue = (value, base = dayjs()) => {
  if (!value) return null;
  if (dayjs.isDayjs(value) || value instanceof Date) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : null;
  }
  const text = String(value);
  const date = DATE_RE.exec(text);
  const time = TIME_RE.exec(text);
  if (!date && !time) return null;
  let result = base.startOf('day');
  if (date) {
    result = result
      .year(Number(date[1]))
      .month(Number(date[2]) - 1)
      .date(Number(date[3]));
  }
  if (time) {
    result = result.hour(Number(time[1])).minute(Number(time[2]));
  }
  return result.isValid() ? result : null;
};

export const formatValue = (date, format) => (date ? date.locale('en').format(format) : '');

export const sameDay = (a, b) => Boolean(a && b && a.isSame(b, 'day'));

// First day of the week for the active dayjs locale (Sunday for Hebrew/English).
export const weekStart = () => dayjs.Ls[dayjs.locale()]?.weekStart ?? 0;

// Six rows of seven days covering `month`, starting on the locale's first weekday.
export const monthGrid = (month, start = weekStart()) => {
  const first = month.startOf('month');
  const offset = (first.day() - start + 7) % 7;
  const gridStart = first.subtract(offset, 'day');
  return Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'));
};

export const weekdayLabels = (start = weekStart()) => {
  const sunday = dayjs().day(0);
  return Array.from({ length: 7 }, (_, index) =>
    sunday.add((start + index) % 7, 'day').format('dd'),
  );
};

// Minute options in `step` increments. A current value off the step (e.g. 10:03 with a 5 minute
// step) is kept in the list so existing data still shows and is not silently rounded.
export const minuteOptions = (step = 5, current = null) => {
  const safeStep = Math.min(Math.max(Math.round(step) || 1, 1), 30);
  const values = [];
  for (let minute = 0; minute < 60; minute += safeStep) values.push(minute);
  if (current != null && !values.includes(current)) {
    values.push(current);
    values.sort((a, b) => a - b);
  }
  return values;
};

// Rounds to the nearest step (used for "now" and the default time of a fresh value).
export const roundToStep = (date, step = 5) => {
  if (step <= 1) return date.second(0).millisecond(0);
  const minutes = Math.round(date.minute() / step) * step;
  return date.minute(0).second(0).millisecond(0).add(minutes, 'minute');
};

export const isOutside = (day, min, max, unit = 'day') =>
  Boolean((min && day.isBefore(min, unit)) || (max && day.isAfter(max, unit)));

export const pad = (value) => String(value).padStart(2, '0');

// Synthetic change event so the pickers keep the `onChange={(e) => e.target.value}` contract of
// the TextFields they replace.
export const changeEvent = (value, name) => ({
  target: { value, name },
  currentTarget: { value, name },
});

// What the closed field shows: the locale's short date (DD/MM/YYYY in Hebrew) and a 24h time.
export const displayDate = (date) => (date ? date.format('L') : '');
export const displayTime = (date) => (date ? date.format('HH:mm') : '');
export const displayDateTime = (date) =>
  date ? `${date.format('L')}  ${date.format('HH:mm')}` : '';

// Shorter date for range fields: the year is dropped when both ends fall in the current year.
const shortDateFormat = () => {
  const long = dayjs.Ls[dayjs.locale()]?.formats?.L || 'MM/DD/YYYY';
  return long.replace(/[^A-Za-z]?Y{2,4}[^A-Za-z]?/, '') || 'DD/MM';
};

export const displayRange = (start, end, withTime) => {
  if (!start || !end) return '';
  const thisYear = dayjs().year();
  const compact = start.year() === thisYear && end.year() === thisYear;
  const dateFormat = compact ? shortDateFormat() : 'L';
  const show = (date) => `${date.format(dateFormat)}${withTime ? ` ${date.format('HH:mm')}` : ''}`;
  return `${show(start)} – ${show(end)}`;
};
