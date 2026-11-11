// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { uid } from '../layout/model';
import { removeWidget } from '../layout/operations';
import { presetOf } from '../widgets/catalog';
import { minOfFor, normalizeDashboard } from './schema';

// Built-in dashboards. A cell is [w, preset] or [w, [preset, h], [preset, h]] for a
// stack. Widgets that are not available to the user are removed, and the layout
// closes around them, so a template is always gapless. Pure.

export const TEMPLATES = {
  operations: {
    nameKey: 'dashboardTplOperations',
    period: 'today',
    rows: [
      [3, [12, 'fleetKpis']],
      [5, [12, 'attention']],
      [9, [8, 'liveMap'], [4, ['fleetStatus', 5], ['motionState', 4]]],
      [6, [4, 'speedDistribution'], [4, 'lastReport'], [4, 'expiries']],
    ],
  },
  activity: {
    nameKey: 'dashboardTplActivity',
    period: 'last7',
    rows: [
      [3, [12, 'activityKpis']],
      [6, [8, 'distanceTrend'], [4, 'distanceByVehicle']],
      [5, [6, 'tripsByHour'], [6, 'idleByVehicle']],
      [7, [6, 'eventsByType'], [6, 'topVehicles']],
    ],
  },
  maintenance: {
    nameKey: 'dashboardTplMaintenance',
    period: 'thisMonth',
    rows: [
      [3, [12, 'fleetOpsKpis']],
      [6, [6, 'expiries'], [6, 'maintenanceDue']],
      [6, [8, 'costsTrend'], [4, 'costsByCategory']],
      [5, [4, 'workOrdersStatus'], [4, 'incidentsBySeverity'], [4, 'costPerVehicle']],
    ],
  },
  // REP-19: three more starting points.
  safety: {
    nameKey: 'dashboardTplSafety',
    period: 'last30',
    rows: [
      [6, [6, 'safetyScores'], [6, 'overspeedByVehicle']],
      [6, [6, 'distanceByDriver'], [6, 'afterHoursByDriver']],
      [6, [8, 'eventsTrend'], [4, 'incidentsBySeverity']],
    ],
  },
  fuelCosts: {
    nameKey: 'dashboardTplFuelCosts',
    period: 'thisMonth',
    rows: [
      [3, [12, 'efficiencyKpis']],
      [6, [6, 'fuelByVehicle'], [6, 'costsByCategory']],
      [6, [8, 'costsTrend'], [4, 'costPerVehicle']],
    ],
  },
  monthly: {
    nameKey: 'dashboardTplMonthly',
    period: 'lastMonth',
    rows: [
      [3, [12, 'activityKpis']],
      [3, [12, 'fleetOpsKpis']],
      [6, [8, 'distanceTrend'], [4, 'costsByCategory']],
      [6, [6, 'safetyScores'], [6, 'workOrdersStatus']],
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

const presetsOf = (template) =>
  template.rows.flatMap(([, ...cells]) =>
    cells.flatMap(([, ...items]) => items.map((item) => (Array.isArray(item) ? item[0] : item))),
  );

// Share of a template's widgets that are available (templates under half are not offered).
export const templateCoverage = (key, available) => {
  const presets = presetsOf(TEMPLATES[key]);
  return presets.filter((preset) => available(presetOf(preset))).length / presets.length;
};

export const instantiateTemplate = (key, available = () => true) => {
  const template = TEMPLATES[key] ?? TEMPLATES.operations;
  const widgets = {};
  let counter = 0;
  const add = (preset) => {
    counter += 1;
    const id = `w${counter}`;
    widgets[id] = { preset };
    return id;
  };
  let rows = template.rows.map(([h, ...cells]) => ({
    id: uid('r'),
    h,
    cells: cells.map(([w, ...items]) => ({
      id: uid('c'),
      w,
      items: items.map((item) =>
        Array.isArray(item) ? { id: add(item[0]), h: item[1] } : { id: add(item), h },
      ),
    })),
  }));
  const minOf = minOfFor(widgets);
  Object.entries(widgets).forEach(([id, widget]) => {
    if (!available(presetOf(widget.preset))) {
      rows = removeWidget(rows, id, minOf);
      delete widgets[id];
    }
  });
  return normalizeDashboard({
    id: uid('d'),
    nameKey: template.nameKey,
    filters: { period: template.period, groupIds: [] },
    refresh: 0,
    rows,
    widgets,
  });
};

export const emptyDashboard = (name) =>
  normalizeDashboard({
    id: uid('d'),
    name,
    filters: { period: 'today', groupIds: [] },
    rows: [],
    widgets: {},
  });
