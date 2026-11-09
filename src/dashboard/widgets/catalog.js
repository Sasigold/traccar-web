// Ready-made widgets. Each preset is a starting point: chart presets can be changed
// into any dataset × measure × dimension × form in the widget settings. Pure.
//
// size / min are in grid units: w = columns of 12, h = height units (40px + gap).

export const CATEGORIES = ['live', 'activity', 'fleet', 'custom'];

const chart = (id, category, query, viz, size = { w: 4, h: 6 }, extra = {}) => ({
  id,
  category,
  kind: 'chart',
  titleKey: `dashboardW${id[0].toUpperCase()}${id.slice(1)}`,
  query,
  viz,
  size,
  min: { w: 3, h: 4 },
  mobileH: 7,
  ...extra,
});

export const PRESETS = [
  // ─── live ────────────────────────────────────────────────────────────────
  {
    id: 'fleetKpis',
    category: 'live',
    kind: 'kpis',
    titleKey: 'dashboardWFleetKpis',
    metrics: ['live.vehicles', 'live.moving', 'live.idle', 'live.offline', 'live.availability'],
    size: { w: 12, h: 3 },
    min: { w: 4, h: 2 },
    mobileH: 5,
  },
  {
    id: 'movingHero',
    category: 'live',
    kind: 'hero',
    titleKey: 'dashboardWMovingHero',
    query: { ds: 'live', m: 'moving' },
    size: { w: 4, h: 5 },
    min: { w: 3, h: 3 },
    mobileH: 4,
    singleton: true,
  },
  chart('fleetStatus', 'live', { ds: 'live', m: 'vehicles', d: 'status' }, 'donut', { w: 4, h: 6 }),
  chart(
    'motionState',
    'live',
    { ds: 'live', m: 'vehicles', d: 'motion' },
    'segmented',
    { w: 4, h: 4 },
    {
      min: { w: 3, h: 3 },
      mobileH: 5,
    },
  ),
  chart('speedDistribution', 'live', { ds: 'live', m: 'vehicles', d: 'speedBand' }, 'columns'),
  chart('fuelLevels', 'live', { ds: 'live', m: 'vehicles', d: 'fuelBand' }, 'columns'),
  chart('lastReport', 'live', { ds: 'live', m: 'vehicles', d: 'lastReport' }, 'bars'),
  chart('fleetComposition', 'live', { ds: 'live', m: 'vehicles', d: 'category' }, 'donut'),
  chart('vehiclesByGroup', 'live', { ds: 'live', m: 'vehicles', d: 'group', n: 6 }, 'bars'),
  {
    id: 'liveMap',
    category: 'live',
    kind: 'map',
    titleKey: 'dashboardWLiveMap',
    size: { w: 8, h: 9 },
    min: { w: 4, h: 5 },
    mobileH: 8,
    singleton: true,
  },
  {
    id: 'eventFeed',
    category: 'live',
    kind: 'feed',
    titleKey: 'dashboardWEventFeed',
    size: { w: 4, h: 8 },
    min: { w: 3, h: 4 },
    mobileH: 8,
  },

  // ─── activity (period) ───────────────────────────────────────────────────
  {
    id: 'activityKpis',
    category: 'activity',
    kind: 'kpis',
    titleKey: 'dashboardWActivityKpis',
    metrics: [
      'summary.distance',
      'summary.engineHours',
      'summary.fuel',
      'summary.activeVehicles',
      'events.overspeed',
    ],
    compare: true,
    size: { w: 12, h: 3 },
    min: { w: 4, h: 2 },
    mobileH: 5,
    gate: { reports: true },
  },
  // REP-06: the measures fleet managers ask about.
  {
    id: 'efficiencyKpis',
    category: 'activity',
    kind: 'kpis',
    titleKey: 'dashboardWEfficiencyKpis',
    metrics: [
      'summary.fuelPer100',
      'summary.co2',
      'stops.idlePct',
      'trips.afterHoursDistance',
      'trips.activeDaysPct',
    ],
    compare: true,
    size: { w: 12, h: 3 },
    min: { w: 4, h: 2 },
    mobileH: 5,
    gate: { reports: true },
  },
  chart(
    'fuelPer100ByVehicle',
    'activity',
    { ds: 'summary', m: 'fuelPer100', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    { gate: { reports: true } },
  ),
  chart(
    'afterHoursByDriver',
    'activity',
    { ds: 'trips', m: 'afterHoursDistance', d: 'driver', n: 8 },
    'bars',
    undefined,
    { gate: { reports: true } },
  ),
  chart(
    'distanceTrend',
    'activity',
    { ds: 'summary', m: 'distance', d: 'time' },
    'columns',
    { w: 8, h: 6 },
    {
      gate: { reports: true },
    },
  ),
  chart(
    'distanceByVehicle',
    'activity',
    { ds: 'summary', m: 'distance', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'engineHoursByVehicle',
    'activity',
    { ds: 'summary', m: 'engineHours', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'fuelByVehicle',
    'activity',
    { ds: 'summary', m: 'fuel', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'tripsByHour',
    'activity',
    { ds: 'trips', m: 'trips', d: 'hour' },
    'columns',
    { w: 6, h: 5 },
    {
      gate: { reports: true },
    },
  ),
  chart(
    'tripsByWeekday',
    'activity',
    { ds: 'trips', m: 'distance', d: 'weekday' },
    'columns',
    { w: 4, h: 5 },
    {
      gate: { reports: true },
    },
  ),
  chart(
    'distanceByDriver',
    'activity',
    { ds: 'trips', m: 'distance', d: 'driver', n: 8 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'idleByVehicle',
    'activity',
    { ds: 'stops', m: 'idleTime', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'eventsByType',
    'activity',
    { ds: 'events', m: 'events', d: 'eventType', n: 7 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'overspeedByVehicle',
    'activity',
    { ds: 'events', m: 'overspeed', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      gate: { reports: true },
    },
  ),
  chart(
    'eventsTrend',
    'activity',
    { ds: 'events', m: 'events', d: 'time', b: 'eventType' },
    'stacked',
    { w: 8, h: 6 },
    {
      gate: { reports: true },
    },
  ),
  {
    id: 'topVehicles',
    category: 'activity',
    kind: 'table',
    titleKey: 'dashboardWTopVehicles',
    size: { w: 6, h: 7 },
    min: { w: 4, h: 4 },
    mobileH: 8,
    gate: { reports: true },
  },

  // ─── fleet: validity, maintenance, costs, safety ─────────────────────────
  {
    id: 'expiries',
    category: 'fleet',
    kind: 'expiries',
    titleKey: 'dashboardWExpiries',
    size: { w: 4, h: 6 },
    min: { w: 3, h: 4 },
    mobileH: 7,
  },
  {
    id: 'maintenanceDue',
    category: 'fleet',
    kind: 'maintenance',
    titleKey: 'dashboardWMaintenanceDue',
    size: { w: 4, h: 6 },
    min: { w: 3, h: 4 },
    mobileH: 7,
    gate: { feature: 'disableMaintenance' },
  },
  {
    id: 'fleetOpsKpis',
    category: 'fleet',
    kind: 'kpis',
    titleKey: 'dashboardWFleetOpsKpis',
    metrics: ['workOrders.open', 'incidents.open', 'expiries.expired', 'costs.amount'],
    size: { w: 12, h: 3 },
    min: { w: 4, h: 2 },
    mobileH: 5,
  },
  chart(
    'costsByCategory',
    'fleet',
    { ds: 'costs', m: 'amount', d: 'costCategory' },
    'donut',
    undefined,
    {
      gate: { fleet: 'costs.read' },
    },
  ),
  chart(
    'costsTrend',
    'fleet',
    { ds: 'costs', m: 'amount', d: 'month', b: 'costCategory', w: 'months6' },
    'stacked',
    { w: 8, h: 6 },
    {
      gate: { fleet: 'costs.read' },
    },
  ),
  chart(
    'costPerVehicle',
    'fleet',
    { ds: 'costs', m: 'amount', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      gate: { fleet: 'costs.read' },
    },
  ),
  chart(
    'workOrdersStatus',
    'fleet',
    { ds: 'workOrders', m: 'count', d: 'workOrderStatus' },
    'segmented',
    { w: 4, h: 4 },
    {
      gate: { fleet: 'maintenance.read' },
      min: { w: 3, h: 3 },
    },
  ),
  chart(
    'incidentsBySeverity',
    'fleet',
    { ds: 'incidents', m: 'count', d: 'severity' },
    'donut',
    undefined,
    {
      gate: { fleet: 'incidents.read' },
    },
  ),
  chart(
    'safetyScores',
    'fleet',
    { ds: 'safety', m: 'score', d: 'driver', n: 8, s: 'asc' },
    'bars',
    undefined,
    {
      gate: { fleet: 'safety.read', reports: true },
    },
  ),

  // ─── custom ──────────────────────────────────────────────────────────────
  chart(
    'custom',
    'custom',
    { ds: 'summary', m: 'distance', d: 'vehicle', n: 8 },
    'bars',
    undefined,
    {
      titleKey: 'dashboardWCustom',
    },
  ),
];

export const PRESET_MAP = Object.fromEntries(PRESETS.map((preset) => [preset.id, preset]));

export const presetOf = (id) => PRESET_MAP[id] ?? null;

const FALLBACK = { size: { w: 4, h: 6 }, min: { w: 3, h: 4 }, mobileH: 7 };

// Size information for a widget config.
export const widgetInfo = (config) => {
  const preset = presetOf(config?.preset) ?? FALLBACK;
  if (preset.kind === 'chart' && config?.viz === 'kpi') {
    return { size: { w: 3, h: 3 }, min: { w: 2, h: 2 }, mobileH: 3, pair: true };
  }
  if (preset.kind === 'chart' && (config?.viz === 'segmented' || config?.viz === 'meter')) {
    return { size: preset.size, min: { w: 3, h: 3 }, mobileH: 5 };
  }
  return {
    size: preset.size,
    min: preset.min,
    mobileH: preset.mobileH,
    pair: preset.kind === 'hero',
  };
};

// gates: { reports: bool, fleet: (permission) => bool, features: {} }
export const presetAvailable = (preset, gates) => {
  const gate = preset?.gate;
  if (!preset) {
    return false;
  }
  if (!gate) {
    return true;
  }
  if (gate.reports && !gates.reports) {
    return false;
  }
  if (gate.feature && gates.features?.[gate.feature]) {
    return false;
  }
  if (gate.fleet && !gates.fleet(gate.fleet)) {
    return false;
  }
  return true;
};
