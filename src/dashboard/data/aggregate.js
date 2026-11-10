// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { bucketStart } from './periods';

// Turns rows into a form-agnostic model:
//   { kind: 'scalar', value }
//   { kind: 'categorical', items: [{ key, value, values?, other?, keys? }], total, series? }
//   { kind: 'timeseries', bucket, points: [{ key, value, values?, future, partial }], series? }
// Pure.

export const OTHER = '__other';
const MAX_SERIES = 4;

const numbers = (rows, value, ctx) =>
  rows
    .map((row) => value(row, ctx))
    .filter((item) => item != null && !Number.isNaN(Number(item)))
    .map(Number);

export const reduceMeasure = (rows, measure, ctx = {}) => {
  const list = measure.filter ? rows.filter((row) => measure.filter(row, ctx)) : rows;
  switch (measure.agg) {
    case 'count':
      return list.length;
    case 'sum':
      return numbers(list, measure.value, ctx).reduce((total, value) => total + value, 0);
    case 'max': {
      const values = numbers(list, measure.value, ctx);
      return values.length ? Math.max(...values) : null;
    }
    case 'min': {
      const values = numbers(list, measure.value, ctx);
      return values.length ? Math.min(...values) : null;
    }
    case 'avg': {
      const values = numbers(list, measure.value, ctx);
      return values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null;
    }
    case 'wavg': {
      let weightSum = 0;
      let total = 0;
      list.forEach((row) => {
        const value = Number(measure.value(row));
        const weight = Number(measure.weight(row));
        if (Number.isFinite(value) && Number.isFinite(weight) && weight > 0) {
          total += value * weight;
          weightSum += weight;
        }
      });
      return weightSum ? total / weightSum : null;
    }
    case 'distinct':
      return new Set(list.map(measure.value)).size;
    // Σ numerator / Σ denominator × scale, over rows that have both (REP-06): fuel per 100 km,
    // idle share. Dividing the sums keeps long trips from counting like short ones.
    case 'quotient': {
      let numerator = 0;
      let denominator = 0;
      list.forEach((row) => {
        const top = measure.numerator(row, ctx);
        const bottom = measure.denominator(row, ctx);
        if (top == null || bottom == null) {
          return;
        }
        const n = Number(top);
        const d = Number(bottom);
        if (Number.isFinite(n) && Number.isFinite(d) && d > 0) {
          numerator += n;
          denominator += d;
        }
      });
      return denominator ? (numerator / denominator) * (measure.scale ?? 1) : null;
    }
    case 'custom':
      return measure.reduce(list, ctx);
    case 'ratio':
      return rows.length ? (100 * list.length) / rows.length : null;
    default:
      return null;
  }
};

// Values that add up across groups (for the "Other" fold and totals).
const additive = (measure) => ['count', 'sum'].includes(measure.agg);

const groupRows = (rows, key) => {
  const groups = new Map();
  rows.forEach((row) => {
    const value = key(row);
    if (value === null || value === undefined || value === '') {
      return;
    }
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value).push(row);
  });
  return groups;
};

const seriesKeys = (rows, breakdown, measure, ctx) => {
  const groups = groupRows(rows, (row) => breakdown.key(row, ctx));
  const ranked = [...groups.entries()]
    .map(([key, list]) => ({ key, value: reduceMeasure(list, measure, ctx) ?? 0 }))
    .sort((a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)));
  if (breakdown.order) {
    const order = breakdown.order.filter((key) => groups.has(key));
    return order.length > MAX_SERIES ? [...order.slice(0, MAX_SERIES - 1), OTHER] : order;
  }
  if (ranked.length <= MAX_SERIES) {
    return ranked.map((item) => item.key);
  }
  return [...ranked.slice(0, MAX_SERIES - 1).map((item) => item.key), OTHER];
};

const splitBySeries = (rows, breakdown, series, measure, ctx) => {
  const named = new Set(series.filter((key) => key !== OTHER));
  const values = {};
  series.forEach((key) => {
    const list = rows.filter((row) => {
      const value = breakdown.key(row, ctx);
      return key === OTHER ? value != null && !named.has(value) : value === key;
    });
    values[key] = reduceMeasure(list, measure, ctx) ?? 0;
  });
  return values;
};

const compare = (sort, order) => (a, b) => {
  if (sort === 'natural' && order) {
    return order.indexOf(a.key) - order.indexOf(b.key);
  }
  const direction = sort === 'asc' ? 1 : -1;
  return (
    direction * ((a.value ?? -Infinity) - (b.value ?? -Infinity)) ||
    String(a.key).localeCompare(String(b.key))
  );
};

// spec: { dimension, measure, breakdown, topN, sort, buckets, bucket }
// ctx:  { timeOf, groupOf, now, ... } passed to keys and filters
export const aggregate = (rows, spec, ctx = {}) => {
  const { dimension, measure, breakdown } = spec;
  if (!dimension) {
    return { kind: 'scalar', value: reduceMeasure(rows, measure, ctx) };
  }

  if (dimension.type === 'time') {
    const bucket = dimension.bucket ?? spec.bucket ?? 'day';
    const byBucket = groupRows(rows, (row) => {
      const time = ctx.timeOf(row);
      return Number.isFinite(time) ? bucketStart(time, bucket) : null;
    });
    const series = breakdown ? seriesKeys(rows, breakdown, measure, ctx) : null;
    const points = (spec.buckets ?? []).map((item) => {
      const list = byBucket.get(item.key) ?? [];
      const empty = additive(measure) ? 0 : null;
      return {
        key: item.key,
        future: item.future,
        partial: item.partial,
        value: item.future ? null : list.length ? reduceMeasure(list, measure, ctx) : empty,
        values:
          series && !item.future ? splitBySeries(list, breakdown, series, measure, ctx) : null,
      };
    });
    return { kind: 'timeseries', bucket, points, series };
  }

  const groups = groupRows(rows, (row) => dimension.key(row, ctx));
  if (dimension.type === 'ordinal' && dimension.order) {
    dimension.order.forEach((key) => {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
    });
  }
  const series = breakdown ? seriesKeys(rows, breakdown, measure, ctx) : null;
  let items = [...groups.entries()].map(([key, list]) => ({
    key,
    value:
      list.length || dimension.type === 'ordinal' ? (reduceMeasure(list, measure, ctx) ?? 0) : null,
    values: series ? splitBySeries(list, breakdown, series, measure, ctx) : null,
    rows: list,
  }));
  items = items.filter((item) => item.value !== null);
  const sort =
    spec.sort === 'natural' || dimension.type === 'ordinal' || (!spec.sort && dimension.order)
      ? 'natural'
      : (spec.sort ?? 'desc');
  items.sort(
    compare(sort, dimension.order ?? (sort === 'natural' ? items.map((item) => item.key) : null)),
  );

  const fold =
    dimension.type === 'category' && !dimension.order && spec.topN && items.length > spec.topN;
  if (fold) {
    const kept = items.slice(0, spec.topN - 1);
    const rest = items.slice(spec.topN - 1);
    const restRows = rest.flatMap((item) => item.rows);
    items = [
      ...kept,
      {
        key: OTHER,
        other: true,
        keys: rest.map((item) => item.key),
        value: reduceMeasure(restRows, measure, ctx),
        values: series ? splitBySeries(restRows, breakdown, series, measure, ctx) : null,
        rows: restRows,
      },
    ];
  }

  const covered = items.flatMap((item) => item.rows);
  const total = additive(measure)
    ? items.reduce((sum, item) => sum + (item.value ?? 0), 0)
    : reduceMeasure(covered, measure, ctx);
  return {
    kind: 'categorical',
    items: items.map(({ rows: list, ...item }) => ({ ...item, count: list.length })),
    total,
    series,
  };
};

// Relative change in percent, or null when there is nothing to compare with.
export const delta = (current, previous) => {
  if (current == null || previous == null || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};
