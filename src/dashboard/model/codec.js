import { uid } from '../layout/model';
import { normalizeDoc } from './schema';

// Compact wire form of the dashboard document. It is stored as JSON in the fleet database
// (`dashboards`, `dashboard_defaults`, ARC-09) and in localStorage; without the fleet database,
// as a JSON string in the user attribute `web.dashboard` (Traccar keeps all attributes in one
// ~4000 character column, hence MAX_REMOTE_CHARS) and in the server attribute
// `web.dashboardDefault`. See remote.js.
//
//   { v, a: activeId, t: updatedAt (s), d: [{ i, n?, k?, f: [period, from?, to?], g, r,
//     L: [[h, [w, item, ...], ...], ...], W: { id: preset | [preset, viz, query, title, metrics] } }] }
//   item: "id" when alone in its cell, else ["id", h]. Row and cell ids are not saved.

export const ATTRIBUTE = 'web.dashboard';
export const DEFAULT_ATTRIBUTE = 'web.dashboardDefault';
export const MAX_REMOTE_CHARS = 3000;
export const MAX_ATTRIBUTES_CHARS = 3900;

const trimTail = (list) => {
  const copy = [...list];
  while (copy.length && (copy.at(-1) === 0 || copy.at(-1) === undefined)) {
    copy.pop();
  }
  return copy;
};

const encodeWidget = (widget) => {
  const parts = trimTail([
    widget.preset,
    widget.viz ?? 0,
    widget.query ?? 0,
    widget.title ?? 0,
    widget.metrics ?? 0,
    widget.target ?? 0,
  ]);
  return parts.length === 1 ? parts[0] : parts;
};

const decodeWidget = (value) => {
  if (typeof value === 'string') {
    return { preset: value };
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const [preset, viz, query, title, metrics, target] = value;
  return {
    preset,
    ...(viz ? { viz } : {}),
    ...(query ? { query } : {}),
    ...(title ? { title } : {}),
    ...(metrics ? { metrics } : {}),
    ...(target ? { target } : {}),
  };
};

export const encodeDashboard = (dashboard) => {
  const { filters } = dashboard;
  const out = {
    i: dashboard.id,
    f:
      filters.period === 'custom'
        ? [filters.period, filters.from, filters.to]
        : filters.offset
          ? [filters.period, null, null, filters.offset]
          : [filters.period],
    g: filters.groupIds,
    r: dashboard.refresh,
    L: dashboard.rows.map((row) => [
      row.h,
      ...row.cells.map((cell) => [
        cell.w,
        ...(cell.items.length === 1
          ? [cell.items[0].id]
          : cell.items.map((item) => [item.id, item.h])),
      ]),
    ]),
    W: Object.fromEntries(
      Object.entries(dashboard.widgets).map(([id, widget]) => [id, encodeWidget(widget)]),
    ),
  };
  if (filters.driverId) {
    out.v = filters.driverId;
  }
  if (dashboard.name) {
    out.n = dashboard.name;
  } else if (dashboard.nameKey) {
    out.k = dashboard.nameKey;
  }
  return out;
};

const decodeDashboard = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const rows = (Array.isArray(value.L) ? value.L : []).map((row) => {
    const [h, ...cells] = Array.isArray(row) ? row : [];
    return {
      id: uid('r'),
      h,
      cells: cells.map((cell) => {
        const [w, ...items] = Array.isArray(cell) ? cell : [];
        return {
          id: uid('c'),
          w,
          items: items.map((item) =>
            Array.isArray(item) ? { id: String(item[0]), h: item[1] } : { id: String(item), h },
          ),
        };
      }),
    };
  });
  const [period, from, to, offset] = Array.isArray(value.f) ? value.f : [];
  return {
    id: value.i,
    name: value.n,
    nameKey: value.k,
    filters: { period, from, to, offset, groupIds: value.g, driverId: value.v },
    refresh: value.r,
    rows,
    widgets: Object.fromEntries(
      Object.entries(value.W && typeof value.W === 'object' ? value.W : {}).map(([id, widget]) => [
        id,
        decodeWidget(widget),
      ]),
    ),
  };
};

export const encode = (doc) =>
  JSON.stringify({
    v: doc.v,
    a: doc.activeId,
    t: Math.round((doc.updatedAt || 0) / 1000),
    d: doc.dashboards.map(encodeDashboard),
  });

// String or object → normalized document, or null when nothing usable is there.
export const decode = (input) => {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || !Array.isArray(value.d)) {
    return null;
  }
  return normalizeDoc({
    v: value.v,
    activeId: value.a,
    updatedAt: Number.isFinite(value.t) ? value.t * 1000 : 0,
    dashboards: value.d.map(decodeDashboard),
  });
};

// Whether the encoded document can go into the user attributes next to the others.
export const fitsRemote = (encoded, attributes = {}) => {
  if (encoded.length > MAX_REMOTE_CHARS) {
    return false;
  }
  const others = { ...attributes };
  delete others[ATTRIBUTE];
  return JSON.stringify({ ...others, [ATTRIBUTE]: encoded }).length <= MAX_ATTRIBUTES_CHARS;
};

// REP-19: one dashboard, as it travels in a share link.
export const encodeDashboardValue = (dashboard) => encodeDashboard(dashboard);
export const decodeDashboardValue = (value) => decodeDashboard(value);
