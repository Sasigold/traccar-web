import { MAX_DASHBOARDS, MAX_WIDGETS, uid } from '../layout/model';
import { normalizeRows } from '../layout/normalize';
import { DEFAULT_PERIOD, PERIODS, validCustom } from '../data/periods';
import { DATASETS } from '../data/datasets';
import { VIZ } from '../widgets/vizRules';
import { presetOf, widgetInfo } from '../widgets/catalog';

// The saved dashboard document and its validation. Pure.
//
// doc       { v, activeId, updatedAt, dashboards: [Dashboard] }
// Dashboard { id, name?, nameKey?, filters: { period, from?, to?, groupIds }, refresh,
//             rows: [Row], widgets: { [id]: { preset, viz?, query?, title?, metrics? } } }

export const VERSION = 1;
export const REFRESH_OPTIONS = [0, 60, 300, 900];
export const NAME_MAX = 40;
export const TITLE_MAX = 60;

export const minOfFor = (widgets) => (id) => widgetInfo(widgets[id]).min;
export const sizeOfFor = (widgets) => (id) => widgetInfo(widgets[id]).size;

export const normalizeFilters = (filters) => {
  const period = PERIODS.includes(filters?.period) ? filters.period : DEFAULT_PERIOD;
  const result = {
    period,
    groupIds: Array.isArray(filters?.groupIds)
      ? [...new Set(filters.groupIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      : [],
  };
  // REP-17: a preset moved back on the calendar (0 = the current one, never ahead).
  const offset = Math.trunc(Number(filters?.offset));
  if (period !== 'custom' && Number.isFinite(offset) && offset < 0 && offset >= -120) {
    result.offset = offset;
  }
  if (period === 'custom') {
    if (validCustom(filters.from, filters.to)) {
      result.from = filters.from;
      result.to = filters.to;
    } else {
      result.period = DEFAULT_PERIOD;
    }
  }
  return result;
};

const cleanQuery = (query) => {
  if (!query || typeof query !== 'object') {
    return undefined;
  }
  const result = {};
  if (DATASETS[query.ds]) {
    result.ds = query.ds;
    const dataset = DATASETS[query.ds];
    if (dataset.measures[query.m]) {
      result.m = query.m;
    }
    if (dataset.dimensions.includes(query.d)) {
      result.d = query.d;
    }
    if (dataset.dimensions.includes(query.b) && query.b !== query.d) {
      result.b = query.b;
    }
  }
  if (Number.isInteger(query.n) && query.n >= 3 && query.n <= 20) {
    result.n = query.n;
  }
  if (['desc', 'asc', 'natural'].includes(query.s)) {
    result.s = query.s;
  }
  if (query.c === true) {
    result.c = true;
  }
  if (query.w === 'months6' || query.w === 'months12') {
    result.w = query.w;
  }
  return Object.keys(result).length ? result : undefined;
};

const cleanMetrics = (metrics) => {
  if (!Array.isArray(metrics)) {
    return undefined;
  }
  const list = metrics
    .filter((metric) => typeof metric === 'string')
    .filter((metric) => {
      const [ds, m] = metric.split('.');
      return Boolean(DATASETS[ds]?.measures[m]);
    })
    .slice(0, 6);
  return list.length ? [...new Set(list)] : undefined;
};

export const normalizeWidget = (config) => {
  const preset = presetOf(config?.preset);
  if (!preset) {
    return null;
  }
  const widget = { preset: preset.id };
  if (VIZ.includes(config.viz)) {
    widget.viz = config.viz;
  }
  const query = cleanQuery(config.query);
  if (query && preset.kind === 'chart') {
    widget.query = query;
  }
  const metrics = cleanMetrics(config.metrics);
  if (metrics && preset.kind === 'kpis') {
    widget.metrics = metrics;
  }
  if (typeof config.title === 'string' && config.title.trim()) {
    widget.title = config.title.trim().slice(0, TITLE_MAX);
  }
  return widget;
};

export const normalizeDashboard = (input) => {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const widgets = {};
  const singletons = new Set();
  Object.entries(input.widgets ?? {}).forEach(([id, config]) => {
    const widget = normalizeWidget(config);
    if (!widget || Object.keys(widgets).length >= MAX_WIDGETS) {
      return;
    }
    if (presetOf(widget.preset).singleton) {
      if (singletons.has(widget.preset)) {
        return;
      }
      singletons.add(widget.preset);
    }
    widgets[id] = widget;
  });
  const rows = normalizeRows(input.rows, minOfFor(widgets), (id) => Boolean(widgets[id]));
  const placed = new Set(
    rows.flatMap((row) => row.cells.flatMap((cell) => cell.items.map((item) => item.id))),
  );
  Object.keys(widgets).forEach((id) => {
    if (!placed.has(id)) {
      delete widgets[id];
    }
  });
  const dashboard = {
    id: typeof input.id === 'string' && /^[a-z0-9]{1,12}$/i.test(input.id) ? input.id : uid('d'),
    filters: normalizeFilters(input.filters),
    refresh: REFRESH_OPTIONS.includes(input.refresh) ? input.refresh : 0,
    rows,
    widgets,
  };
  if (typeof input.name === 'string' && input.name.trim()) {
    dashboard.name = input.name.trim().slice(0, NAME_MAX);
  } else if (typeof input.nameKey === 'string' && /^dashboard[A-Za-z]+$/.test(input.nameKey)) {
    dashboard.nameKey = input.nameKey;
  }
  return dashboard;
};

export const normalizeDoc = (input) => {
  if (!input || typeof input !== 'object' || !Array.isArray(input.dashboards)) {
    return null;
  }
  const ids = new Set();
  const dashboards = input.dashboards
    .map(normalizeDashboard)
    .filter(Boolean)
    .slice(0, MAX_DASHBOARDS)
    .map((dashboard) => {
      const unique = ids.has(dashboard.id) ? { ...dashboard, id: uid('d') } : dashboard;
      ids.add(unique.id);
      return unique;
    });
  if (!dashboards.length) {
    return null;
  }
  return {
    v: VERSION,
    activeId: ids.has(input.activeId) ? input.activeId : dashboards[0].id,
    updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : 0,
    dashboards,
  };
};
