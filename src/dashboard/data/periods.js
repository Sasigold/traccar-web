import dayjs from 'dayjs';

// Period presets for the dashboard filter row. Pure (dayjs only).

export const PERIODS = [
  'today',
  'yesterday',
  'last7',
  'thisWeek',
  'lastWeek',
  'last30',
  'thisMonth',
  'lastMonth',
  'custom',
];

export const DEFAULT_PERIOD = 'today';

const SHIFT = {
  today: [1, 'day'],
  yesterday: [1, 'day'],
  last7: [7, 'day'],
  thisWeek: [1, 'week'],
  lastWeek: [1, 'week'],
  last30: [30, 'day'],
  thisMonth: [1, 'month'],
  lastMonth: [1, 'month'],
};

export const validCustom = (from, to) => {
  const start = dayjs(from);
  const end = dayjs(to);
  return Boolean(from && to && start.isValid() && end.isValid() && start.isBefore(end));
};

// { from, to } as dayjs, for a preset (or a custom range).
export const periodRange = (period, now = dayjs(), custom = {}) => {
  const today = dayjs(now);
  switch (period) {
    case 'yesterday': {
      const day = today.subtract(1, 'day');
      return { from: day.startOf('day'), to: day.endOf('day') };
    }
    case 'last7':
      return { from: today.subtract(6, 'day').startOf('day'), to: today.endOf('day') };
    case 'thisWeek':
      return { from: today.startOf('week'), to: today.endOf('week') };
    case 'lastWeek': {
      const week = today.subtract(1, 'week');
      return { from: week.startOf('week'), to: week.endOf('week') };
    }
    case 'last30':
      return { from: today.subtract(29, 'day').startOf('day'), to: today.endOf('day') };
    case 'thisMonth':
      return { from: today.startOf('month'), to: today.endOf('month') };
    case 'lastMonth': {
      const month = today.subtract(1, 'month');
      return { from: month.startOf('month'), to: month.endOf('month') };
    }
    case 'custom':
      if (validCustom(custom.from, custom.to)) {
        return { from: dayjs(custom.from), to: dayjs(custom.to) };
      }
      return periodRange('today', now);
    default:
      return { from: today.startOf('day'), to: today.endOf('day') };
  }
};

// Calendar presets move by whole calendar units, so a month stays a whole month (adding a month
// to "February 28, 23:59" would end March on the 28th).
const CALENDAR_UNIT = {
  today: 'day',
  yesterday: 'day',
  thisWeek: 'week',
  lastWeek: 'week',
  thisMonth: 'month',
  lastMonth: 'month',
};

// Moves a range by whole periods (the arrows next to the period select).
export const shiftRange = (period, range, step) => {
  const unit = CALENDAR_UNIT[period];
  if (unit) {
    const from = range.from.add(step, unit).startOf(unit);
    return { from, to: from.endOf(unit) };
  }
  const [amount, amountUnit] = SHIFT[period] ?? [range.to.diff(range.from), 'millisecond'];
  return {
    from: range.from.add(step * amount, amountUnit),
    to: range.to.add(step * amount, amountUnit),
  };
};

// The comparable earlier range: same length of time already elapsed, one period back,
// so "this month so far" compares with the same days of last month.
export const previousRange = (period, range, now = dayjs()) => {
  const end = range.to.isAfter(now) ? dayjs(now) : range.to;
  const elapsed = Math.max(0, end.diff(range.from));
  const [amount, unit] = SHIFT[period] ?? [range.to.diff(range.from) + 1, 'millisecond'];
  const from = range.from.subtract(amount, unit);
  return { from, to: from.add(elapsed, 'millisecond') };
};

export const days = (range) => Math.max(1, Math.ceil(range.to.diff(range.from, 'hour', true) / 24));

// Bucket size for a time axis over the range.
export const bucketFor = (range) => {
  const hours = range.to.diff(range.from, 'hour', true);
  if (hours <= 48) {
    return 'hour';
  }
  return hours <= 24 * 95 ? 'day' : 'week';
};

export const bucketStart = (time, bucket) => dayjs(time).startOf(bucket).valueOf();

// Every bucket of the range, flagged when it is still in the future or in progress.
export const timeBuckets = (range, bucket, now = dayjs()) => {
  const list = [];
  const current = dayjs(now).valueOf();
  let start = range.from.startOf(bucket);
  let guard = 0;
  while (!start.isAfter(range.to) && guard < 1000) {
    const end = start.add(1, bucket);
    list.push({
      key: start.valueOf(),
      start: start.valueOf(),
      end: end.valueOf(),
      future: start.valueOf() > current,
      partial: start.valueOf() <= current && end.valueOf() > current,
    });
    start = end;
    guard += 1;
  }
  return list;
};

export const toIso = (value) => dayjs(value).toISOString();
