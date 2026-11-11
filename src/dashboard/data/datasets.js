// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import dayjs from 'dayjs';
import { speedFromKnots } from '../../common/util/converter';
import { pascalCase } from '../../common/util/stringUtils';
import { activeDaysPct, afterHours, co2Kg, privateTrip } from './fleetMetrics';

// What a widget can show: datasets, their dimensions ("by …") and measures ("how much").
// Pure definitions; labels are l10n keys resolved by the UI.
//
// Units of raw values: distance m, speed knots, duration ms, volume L, money ILS,
// percent 0..100, count, score 0..100.

// ─── live rows ───────────────────────────────────────────────────────────────

export const SPEED_BANDS = {
  kmh: [30, 60, 90, 110],
  mph: [20, 40, 55, 70],
  kn: [15, 30, 50, 60],
};

export const FUEL_BANDS = [15, 30, 60];
export const BATTERY_BANDS = [20, 50, 80];

const band = (value, limits, prefix) => {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  const index = limits.findIndex((limit) => value < limit);
  return `${prefix}${index < 0 ? limits.length : index}`;
};

export const motionOf = (device, position) => {
  if (!position || device.status !== 'online') {
    return 'offline';
  }
  if (position.attributes?.motion || position.speed > 1) {
    return 'moving';
  }
  return position.attributes?.ignition ? 'idle' : 'parked';
};

export const lastReportOf = (lastUpdate, now) => {
  if (!lastUpdate) {
    return 'never';
  }
  const age = now - lastUpdate;
  if (age < 5 * 60000) {
    return 'live';
  }
  if (age < 3600000) {
    return 'hour';
  }
  return age < 86400000 ? 'day' : 'older';
};

// One flat row per vehicle for the live dataset. `fuelRatio(position, device)` gives
// the fuel level 0..1 or null (see telemetry/vehicleProfile.js).
export const liveRow = (device, position, now, speedUnit = 'kmh', fuelRatio = () => null) => {
  const motion = motionOf(device, position);
  const speed = motion === 'moving' ? (position?.speed ?? 0) : 0;
  const lastUpdate = device.lastUpdate ? Date.parse(device.lastUpdate) : null;
  const fuel = position ? fuelRatio(position, device) : null;
  const battery = position?.attributes?.batteryLevel;
  return {
    deviceId: device.id,
    status: ['online', 'offline'].includes(device.status) ? device.status : 'unknown',
    motion,
    groupId: device.groupId || 0,
    category: device.category || 'default',
    speed,
    speedBand:
      motion === 'moving'
        ? band(speedFromKnots(speed, speedUnit), SPEED_BANDS[speedUnit] ?? SPEED_BANDS.kmh, 's')
        : null,
    fuel: fuel == null ? null : Math.round(fuel * 1000) / 10,
    fuelBand: fuel == null ? null : band(fuel * 100, FUEL_BANDS, 'f'),
    battery: battery == null ? null : Number(battery),
    batteryBand: battery == null ? null : band(Number(battery), BATTERY_BANDS, 'b'),
    lastReport: lastReportOf(lastUpdate, now),
    lastUpdate,
    ignition: Boolean(position?.attributes?.ignition),
  };
};

// ─── dimensions ──────────────────────────────────────────────────────────────

// l10n key of a dimension value: prefix + CamelCase value ('in_shop' → 'InShop').
export const labelKeyOf = (prefix, value) => `${prefix}${pascalCase(String(value))}`;

const timeHour = (row, ctx) => dayjs(ctx.timeOf(row)).hour();
const timeWeekday = (row, ctx) => dayjs(ctx.timeOf(row)).day();

export const EVENT_TYPES = [
  'alarm',
  'deviceOverspeed',
  'geofenceEnter',
  'geofenceExit',
  'ignitionOn',
  'ignitionOff',
  'maintenance',
  'driverChanged',
  'deviceFuelDrop',
  'deviceFuelIncrease',
];

export const DIMENSIONS = {
  status: {
    type: 'category',
    key: (row) => row.status,
    order: ['online', 'offline', 'unknown'],
    tones: { online: 'success', offline: 'error', unknown: 'neutral' },
    labelPrefix: 'deviceStatus',
  },
  motion: {
    type: 'category',
    key: (row) => row.motion,
    order: ['moving', 'idle', 'parked', 'offline'],
    tones: { moving: 'success', idle: 'warning', parked: 'neutral', offline: 'error' },
    labelPrefix: 'dashboardMotion',
  },
  group: { type: 'category', key: (row, ctx) => ctx.groupOf(row), ref: 'group' },
  category: {
    type: 'category',
    key: (row, ctx) => (row.category ?? ctx.categoryOf?.(row.deviceId)) || 'default',
    labelPrefix: 'category',
  },
  vehicle: { type: 'category', key: (row) => row.deviceId, ref: 'device' },
  driver: {
    type: 'category',
    key: (row) => row.driverUniqueId || null,
    ref: 'driver',
  },
  speedBand: {
    type: 'ordinal',
    key: (row) => row.speedBand,
    order: ['s0', 's1', 's2', 's3', 's4'],
    ref: 'speedBand',
  },
  fuelBand: {
    type: 'ordinal',
    key: (row) => row.fuelBand,
    order: ['f0', 'f1', 'f2', 'f3'],
    ref: 'fuelBand',
  },
  batteryBand: {
    type: 'ordinal',
    key: (row) => row.batteryBand,
    order: ['b0', 'b1', 'b2', 'b3'],
    ref: 'batteryBand',
  },
  lastReport: {
    type: 'ordinal',
    key: (row) => row.lastReport,
    order: ['live', 'hour', 'day', 'older', 'never'],
    labelPrefix: 'dashboardLastReport',
  },
  hour: {
    type: 'ordinal',
    key: timeHour,
    order: Array.from({ length: 24 }, (_, hour) => hour),
    ref: 'hour',
  },
  weekday: {
    type: 'ordinal',
    key: timeWeekday,
    order: [0, 1, 2, 3, 4, 5, 6],
    ref: 'weekday',
  },
  time: { type: 'time' },
  month: { type: 'time', bucket: 'month' },
  eventType: {
    type: 'category',
    key: (row) =>
      row.type === 'alarm' && row.attributes?.alarm
        ? `alarm:${String(row.attributes.alarm).split(',')[0]}`
        : row.type,
    ref: 'eventType',
  },
  expiryStatus: {
    type: 'category',
    key: (row) => row.status,
    order: ['expired', 'expiring', 'valid'],
    tones: { expired: 'error', expiring: 'warning', valid: 'success' },
    labelPrefix: 'fleetStatus',
  },
  expiryEntity: {
    type: 'category',
    key: (row) => row.entity,
    order: ['vehicle', 'driver'],
    labelPrefix: 'dashboardEntity',
  },
  maintenanceStatus: {
    type: 'category',
    key: (row) => row.maintenanceStatus,
    order: ['overdue', 'due', 'ok', 'unknown'],
    tones: { overdue: 'error', due: 'warning', ok: 'success', unknown: 'neutral' },
    labelPrefix: 'dashboardMaintenance',
  },
  costCategory: {
    type: 'category',
    key: (row) => row.category,
    order: ['fuel', 'maintenance', 'other'],
    labelPrefix: 'dashboardCost',
  },
  workOrderStatus: {
    type: 'category',
    key: (row) => row.status,
    order: ['planned', 'open', 'in_shop', 'done', 'cancelled'],
    labelPrefix: 'fleetWorkOrderStatus',
  },
  severity: {
    type: 'category',
    key: (row) => row.severity,
    order: ['severe', 'moderate', 'minor'],
    tones: { severe: 'error', moderate: 'warning', minor: 'neutral' },
    labelPrefix: 'fleetIncidentSeverity',
  },
  incidentType: {
    type: 'category',
    key: (row) => row.type,
    order: ['accident', 'damage', 'theft', 'vandalism', 'glass', 'other'],
    labelPrefix: 'fleetIncidentType',
  },
};

// ─── measures ────────────────────────────────────────────────────────────────

const isOnline = (row) => row.status === 'online';

const LIVE_MEASURES = {
  vehicles: { agg: 'count', unit: 'count', labelKey: 'dashboardMVehicles' },
  moving: {
    agg: 'count',
    unit: 'count',
    filter: (row) => row.motion === 'moving',
    labelKey: 'dashboardMMoving',
  },
  idle: {
    agg: 'count',
    unit: 'count',
    filter: (row) => row.motion === 'idle',
    labelKey: 'dashboardMIdle',
  },
  parked: {
    agg: 'count',
    unit: 'count',
    filter: (row) => row.motion === 'parked',
    labelKey: 'dashboardMParked',
  },
  online: { agg: 'count', unit: 'count', filter: isOnline, labelKey: 'dashboardMOnline' },
  offline: {
    agg: 'count',
    unit: 'count',
    filter: (row) => !isOnline(row),
    labelKey: 'dashboardMOffline',
    good: 'down',
  },
  availability: {
    agg: 'ratio',
    unit: 'percent',
    filter: isOnline,
    labelKey: 'dashboardMAvailability',
  },
  utilization: {
    agg: 'ratio',
    unit: 'percent',
    filter: (row) => row.motion === 'moving' || row.motion === 'idle',
    labelKey: 'dashboardMUtilization',
  },
  avgSpeed: {
    agg: 'avg',
    unit: 'speed',
    value: (row) => row.speed,
    filter: (row) => row.motion === 'moving',
    labelKey: 'dashboardMAvgSpeed',
  },
  maxSpeed: {
    agg: 'max',
    unit: 'speed',
    value: (row) => row.speed,
    labelKey: 'dashboardMMaxSpeedNow',
  },
  avgFuel: { agg: 'avg', unit: 'percent', value: (row) => row.fuel, labelKey: 'dashboardMAvgFuel' },
  avgBattery: {
    agg: 'avg',
    unit: 'percent',
    value: (row) => row.battery,
    labelKey: 'dashboardMAvgBattery',
  },
};

const SUMMARY_MEASURES = {
  distance: {
    agg: 'sum',
    unit: 'distance',
    value: (row) => row.distance,
    labelKey: 'sharedDistance',
  },
  engineHours: {
    agg: 'sum',
    unit: 'duration',
    value: (row) => row.engineHours,
    labelKey: 'reportEngineHours',
  },
  fuel: {
    agg: 'sum',
    unit: 'volume',
    value: (row) => row.spentFuel,
    labelKey: 'reportSpentFuel',
    good: 'down',
  },
  maxSpeed: {
    agg: 'max',
    unit: 'speed',
    value: (row) => row.maxSpeed,
    labelKey: 'reportMaximumSpeed',
    good: 'down',
  },
  avgSpeed: {
    agg: 'wavg',
    unit: 'speed',
    value: (row) => row.averageSpeed,
    weight: (row) => row.distance,
    labelKey: 'reportAverageSpeed',
  },
  activeVehicles: {
    agg: 'distinct',
    unit: 'count',
    value: (row) => row.deviceId,
    filter: (row) => row.distance > 0,
    labelKey: 'dashboardMActiveVehicles',
  },
  // REP-06: liters per 100 km over the rows that report fuel (Σ liters / Σ meters × 100,000).
  fuelPer100: {
    agg: 'quotient',
    unit: 'fuelRate',
    numerator: (row) => (Number(row.spentFuel) > 0 ? row.spentFuel : null),
    denominator: (row) => row.distance,
    scale: 100000,
    labelKey: 'dashboardMFuelPer100',
    good: 'down',
  },
  co2: {
    agg: 'sum',
    unit: 'mass',
    value: (row, ctx) => co2Kg(row.spentFuel, ctx?.fuelTypeOf?.(row.deviceId)),
    labelKey: 'dashboardMCo2',
    good: 'down',
  },
};

const TRIP_MEASURES = {
  trips: { agg: 'count', unit: 'count', labelKey: 'reportTrips' },
  distance: SUMMARY_MEASURES.distance,
  drivingTime: {
    agg: 'sum',
    unit: 'duration',
    value: (row) => row.duration,
    labelKey: 'dashboardMDrivingTime',
  },
  maxSpeed: SUMMARY_MEASURES.maxSpeed,
  fuel: SUMMARY_MEASURES.fuel,
  // REP-06: driving outside the organization's working hours, private mode, and how many
  // vehicle-days had any driving.
  afterHoursDistance: {
    agg: 'sum',
    unit: 'distance',
    value: (row, ctx) => (afterHours(ctx?.workPolicy, row.startTime) ? row.distance : 0),
    labelKey: 'dashboardMAfterHours',
    good: 'down',
  },
  privateShare: {
    agg: 'quotient',
    unit: 'percent',
    numerator: (row, ctx) => (privateTrip(ctx?.privatePeriods, row) ? row.distance : 0),
    denominator: (row) => row.distance,
    scale: 100,
    needsPrivacy: true,
    labelKey: 'dashboardMPrivateShare',
  },
  activeDaysPct: {
    agg: 'custom',
    unit: 'percent',
    reduce: (rows, ctx) => activeDaysPct(rows, ctx?.vehicleCount, ctx?.rangeDays),
    labelKey: 'dashboardMActiveDays',
  },
};

const STOP_MEASURES = {
  stops: { agg: 'count', unit: 'count', labelKey: 'reportStops' },
  stopTime: {
    agg: 'sum',
    unit: 'duration',
    value: (row) => row.duration,
    labelKey: 'dashboardMStopTime',
  },
  idleTime: {
    agg: 'sum',
    unit: 'duration',
    value: (row) => row.engineHours,
    labelKey: 'dashboardMIdleTime',
    good: 'down',
  },
  // REP-06: the share of standing time with the engine running.
  idlePct: {
    agg: 'quotient',
    unit: 'percent',
    numerator: (row) => row.engineHours,
    denominator: (row) => row.duration,
    scale: 100,
    labelKey: 'dashboardMIdlePct',
    good: 'down',
  },
};

const EVENT_MEASURES = {
  events: { agg: 'count', unit: 'count', labelKey: 'dashboardMEvents' },
  overspeed: {
    agg: 'count',
    unit: 'count',
    filter: (row) => row.type === 'deviceOverspeed',
    labelKey: 'eventDeviceOverspeed',
    good: 'down',
  },
  alarms: {
    agg: 'count',
    unit: 'count',
    filter: (row) => row.type === 'alarm',
    labelKey: 'dashboardMAlarms',
    good: 'down',
  },
};

// ─── datasets ────────────────────────────────────────────────────────────────

export const DATASETS = {
  live: {
    labelKey: 'dashboardDsLive',
    live: true,
    dimensions: [
      'status',
      'motion',
      'group',
      'category',
      'speedBand',
      'fuelBand',
      'batteryBand',
      'lastReport',
      'vehicle',
    ],
    measures: LIVE_MEASURES,
  },
  summary: {
    labelKey: 'dashboardDsSummary',
    report: true,
    time: (row) => Date.parse(row.startTime),
    dimensions: ['vehicle', 'group', 'category', 'time'],
    measures: SUMMARY_MEASURES,
  },
  trips: {
    labelKey: 'reportTrips',
    report: true,
    time: (row) => Date.parse(row.startTime),
    dimensions: ['vehicle', 'group', 'driver', 'hour', 'weekday', 'time'],
    measures: TRIP_MEASURES,
  },
  stops: {
    labelKey: 'reportStops',
    report: true,
    time: (row) => Date.parse(row.startTime),
    dimensions: ['vehicle', 'group', 'hour', 'weekday', 'time'],
    measures: STOP_MEASURES,
  },
  events: {
    labelKey: 'dashboardDsEvents',
    report: true,
    time: (row) => Date.parse(row.eventTime),
    dimensions: ['eventType', 'vehicle', 'group', 'hour', 'weekday', 'time'],
    measures: EVENT_MEASURES,
  },
  expiries: {
    labelKey: 'dashboardDsExpiries',
    dimensions: ['expiryStatus', 'expiryEntity'],
    measures: {
      items: { agg: 'count', unit: 'count', labelKey: 'dashboardMItems' },
      expired: {
        agg: 'count',
        unit: 'count',
        filter: (row) => row.status === 'expired',
        labelKey: 'fleetStatusExpired',
        good: 'down',
      },
    },
  },
  maintenance: {
    labelKey: 'dashboardDsMaintenance',
    dimensions: ['maintenanceStatus', 'vehicle'],
    measures: {
      items: { agg: 'count', unit: 'count', labelKey: 'dashboardMItems' },
    },
  },
  costs: {
    labelKey: 'dashboardDsCosts',
    fleet: 'costs.read',
    time: (row) => Date.parse(row.month),
    dimensions: ['costCategory', 'vehicle', 'month'],
    measures: {
      amount: {
        agg: 'sum',
        unit: 'money',
        value: (row) => Number(row.amount) || 0,
        labelKey: 'dashboardMCosts',
        good: 'down',
      },
    },
  },
  workOrders: {
    labelKey: 'dashboardDsWorkOrders',
    fleet: 'maintenance.read',
    time: (row) => Date.parse(row.opened_at ?? row.created_at),
    dimensions: ['workOrderStatus', 'vehicle', 'month'],
    measures: {
      count: { agg: 'count', unit: 'count', labelKey: 'dashboardMCount' },
      open: {
        agg: 'count',
        unit: 'count',
        filter: (row) => ['planned', 'open', 'in_shop'].includes(row.status),
        current: true,
        labelKey: 'fleetKpiOpenWorkOrders',
        good: 'down',
      },
      totalCost: {
        agg: 'sum',
        unit: 'money',
        value: (row) => Number(row.total_cost) || 0,
        labelKey: 'dashboardMWorkOrderCost',
        good: 'down',
      },
    },
  },
  incidents: {
    labelKey: 'dashboardDsIncidents',
    fleet: 'incidents.read',
    time: (row) => Date.parse(row.occurred_at),
    dimensions: ['severity', 'incidentType', 'vehicle', 'month'],
    measures: {
      count: { agg: 'count', unit: 'count', labelKey: 'dashboardMCount', good: 'down' },
      open: {
        agg: 'count',
        unit: 'count',
        filter: (row) => row.status !== 'closed',
        current: true,
        labelKey: 'fleetKpiOpenIncidents',
        good: 'down',
      },
      repairCost: {
        agg: 'sum',
        unit: 'money',
        value: (row) => Number(row.repair_cost) || 0,
        labelKey: 'dashboardMRepairCost',
        good: 'down',
      },
    },
  },
  safety: {
    labelKey: 'dashboardDsSafety',
    fleet: 'safety.read',
    report: true,
    dimensions: ['driver'],
    measures: {
      score: { agg: 'avg', unit: 'score', value: (row) => row.score, labelKey: 'dashboardMScore' },
      safetyEvents: {
        agg: 'sum',
        unit: 'count',
        value: (row) => row.events,
        labelKey: 'dashboardMSafetyEvents',
        good: 'down',
      },
    },
  },
};

export const datasetOf = (key) => DATASETS[key] ?? null;
export const measureOf = (dataset, key) => DATASETS[dataset]?.measures[key] ?? null;
export const dimensionOf = (key) => (key ? (DIMENSIONS[key] ?? null) : null);

// Fills in missing or invalid parts of a widget query with the dataset's first options.
export const resolveQuery = (query = {}) => {
  const ds = DATASETS[query.ds] ? query.ds : 'live';
  const dataset = DATASETS[ds];
  const m = dataset.measures[query.m] ? query.m : Object.keys(dataset.measures)[0];
  const d = query.d && dataset.dimensions.includes(query.d) ? query.d : null;
  const b =
    query.b &&
    query.b !== d &&
    dataset.dimensions.includes(query.b) &&
    DIMENSIONS[query.b].type !== 'time'
      ? query.b
      : null;
  const n = Math.min(20, Math.max(3, Math.round(Number(query.n)) || 8));
  // Dimensions with a natural order (status, bands) keep it unless a sort was chosen.
  const s = ['desc', 'asc', 'natural'].includes(query.s) ? query.s : null;
  return { ds, m, d, b, n, s, c: Boolean(query.c), w: query.w ?? null };
};

// What has to be fetched for a dataset at a given time bucket.
export const sourceOf = (ds, { bucket, timeAxis } = {}) => {
  switch (ds) {
    case 'summary':
      if (timeAxis) {
        return bucket === 'hour'
          ? { key: 'trips', endpoint: 'trips' }
          : { key: 'summaryDaily', endpoint: 'summary', params: { daily: true } };
      }
      return { key: 'summary', endpoint: 'summary' };
    case 'trips':
    case 'stops':
      return { key: ds, endpoint: ds };
    case 'events':
      return { key: 'events', endpoint: 'events', params: { type: EVENT_TYPES } };
    default:
      return { key: ds };
  }
};

// Trips stand in for summary rows when a day is split into hours.
export const tripAsSummary = (trip) => ({
  deviceId: trip.deviceId,
  startTime: trip.startTime,
  distance: trip.distance,
  engineHours: trip.duration,
  spentFuel: trip.spentFuel,
  maxSpeed: trip.maxSpeed,
  averageSpeed: trip.averageSpeed,
});
