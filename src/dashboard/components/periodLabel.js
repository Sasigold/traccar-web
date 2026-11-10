// Human label of the filter period ("Today", "Last 7 days", "3/11 – 9/11"). Pure.
export const PERIOD_KEYS = {
  today: 'reportToday',
  yesterday: 'reportYesterday',
  last7: 'dashboardLast7',
  thisWeek: 'reportThisWeek',
  lastWeek: 'reportPreviousWeek',
  last30: 'dashboardLast30',
  thisMonth: 'reportThisMonth',
  lastMonth: 'reportPreviousMonth',
  custom: 'reportCustom',
};

// REP-17: a moved preset is named by the calendar: "yesterday", "last week", "October 2026", or
// its dates.
const BASE = { today: 0, yesterday: -1, thisWeek: 0, lastWeek: -1, thisMonth: 0, lastMonth: -1 };
const UNIT = {
  today: 'day',
  yesterday: 'day',
  thisWeek: 'week',
  lastWeek: 'week',
  thisMonth: 'month',
  lastMonth: 'month',
};
const NAMED = {
  day: { 0: 'today', '-1': 'yesterday' },
  week: { 0: 'thisWeek', '-1': 'lastWeek' },
  month: { 0: 'thisMonth', '-1': 'lastMonth' },
};

export const periodLabel = (filters, range, t) => {
  const offset = Number(filters.offset) || 0;
  if (offset && filters.period !== 'custom') {
    const unit = UNIT[filters.period];
    if (unit) {
      const named = NAMED[unit][String(BASE[filters.period] + offset)];
      if (named) return t(PERIOD_KEYS[named]);
      if (unit === 'month') return range.from.format('MMMM YYYY');
      if (unit === 'day') return range.from.format('dddd D/M');
    }
    return `${range.from.format('D/M/YY')} – ${range.to.format('D/M/YY')}`;
  }
  if (filters.period === 'custom') {
    const sameDay = range.from.isSame(range.to, 'day');
    return sameDay
      ? `${range.from.format('D/M')} ${range.from.format('HH:mm')}–${range.to.format('HH:mm')}`
      : `${range.from.format('D/M/YY')} – ${range.to.format('D/M/YY')}`;
  }
  return t(PERIOD_KEYS[filters.period] ?? 'reportToday');
};
