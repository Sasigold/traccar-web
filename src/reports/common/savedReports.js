import { periodRange } from '../../dashboard/data/periods';

// REP-09: a saved report view: which report, which vehicles and groups, and which period preset.
// The period is kept as a preset ("last week"), so opening it next week shows that week.
export const MAX_SAVED_REPORTS = 20;

// The address parts a view keeps apart; everything else on the address (the report's own options,
// e.g. "by day" or "by geofence") is kept as it is.
const RESERVED = ['deviceId', 'groupId', 'from', 'to', 'period', 'columns'];

// The report's options on the address, as [key, value] pairs.
export const reportOptions = (searchParams) =>
  [...new URLSearchParams(searchParams).entries()].filter(([key]) => !RESERVED.includes(key));

export const savedReportView = ({
  name,
  path,
  deviceIds = [],
  groupIds = [],
  period,
  options = [],
  columns = null,
}) => ({
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: String(name).trim().slice(0, 60),
  path,
  deviceIds: deviceIds.filter((id) => id !== 'all').map(Number),
  groupIds: groupIds.map(Number),
  period: period === 'custom' ? 'today' : period,
  // REP-09: the report's options and the columns shown, so the view opens as it was saved.
  ...(options.length && { options }),
  ...(columns?.length && { columns: [...columns] }),
});

export const savedReportLink = (view, now) => {
  const params = new URLSearchParams();
  view.deviceIds.forEach((id) => params.append('deviceId', id));
  view.groupIds.forEach((id) => params.append('groupId', id));
  const { from, to } = periodRange(view.period, now);
  params.set('period', view.period);
  params.set('from', from.toISOString());
  params.set('to', to.toISOString());
  (view.options || []).forEach(([key, value]) => params.append(key, value));
  if (view.columns?.length) params.set('columns', view.columns.join(','));
  return `${view.path}?${params.toString()}`;
};

export const addSavedReport = (views, view) =>
  [view, ...views.filter((item) => item.name !== view.name)].slice(0, MAX_SAVED_REPORTS);
