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

export const periodLabel = (filters, range, t) => {
  if (filters.period === 'custom') {
    const sameDay = range.from.isSame(range.to, 'day');
    return sameDay
      ? `${range.from.format('D/M')} ${range.from.format('HH:mm')}–${range.to.format('HH:mm')}`
      : `${range.from.format('D/M/YY')} – ${range.to.format('D/M/YY')}`;
  }
  return t(PERIOD_KEYS[filters.period] ?? 'reportToday');
};
