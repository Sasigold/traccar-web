import { DIMENSIONS } from '../data/datasets';

// Which forms a widget can take, from the shape of its data. Pure.

export const VIZ = [
  'kpi',
  'meter',
  'donut',
  'pie',
  'segmented',
  'bars',
  'columns',
  'stacked',
  'line',
  'area',
  'table',
];

export const PART_TO_WHOLE = ['donut', 'pie', 'segmented'];
export const MAX_SLICES = 6;

// dimension key → allowed viz list for a query { d, b, m } with a measure.
export const allowedViz = (query, measure) => {
  const dimension = query.d ? DIMENSIONS[query.d] : null;
  if (!dimension) {
    return measure?.unit === 'percent' ? ['kpi', 'meter'] : ['kpi'];
  }
  if (dimension.type === 'time') {
    return query.b
      ? ['stacked', 'columns', 'line', 'area', 'table']
      : ['columns', 'line', 'area', 'table'];
  }
  const list = ['bars', 'columns'];
  const fewParts =
    dimension.type === 'category' || (dimension.order && dimension.order.length <= 7);
  // Shares only make sense for amounts that add up (counts and sums).
  const additive = measure && ['count', 'sum'].includes(measure.agg);
  if (fewParts && additive && !query.b) {
    list.push('donut', 'pie', 'segmented');
  }
  if (query.b) {
    list.push('stacked');
  }
  list.push('table');
  return list;
};

export const pickViz = (wanted, allowed, fallback) => {
  if (allowed.includes(wanted)) {
    return wanted;
  }
  return allowed.includes(fallback) ? fallback : allowed[0];
};

// Part-to-whole forms show at most six parts plus "Other".
export const effectiveTopN = (viz, topN) =>
  PART_TO_WHOLE.includes(viz) ? Math.min(topN, MAX_SLICES + 1) : topN;
