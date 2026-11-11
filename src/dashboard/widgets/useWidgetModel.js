// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useFleetPermission, useFleetStatus } from '../../common/fleet/useFleet';
import { maintenanceStatus } from '../../common/fleet/maintenanceStatus';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useCachedQuery, useDashboardData } from '../data/DashboardDataContext';
import { loadPrivacy } from '../../common/fleet/privacyData';
import { DEFAULT_POLICY } from '../../common/fleet/privacy';
import { DATASETS, dimensionOf, measureOf, sourceOf, tripAsSummary } from '../data/datasets';
import { aggregate, delta } from '../data/aggregate';
import { bucketFor, days, timeBuckets, toIso } from '../data/periods';
import { checkSize, fetchReport } from '../data/reportFetch';
import { assignSlots } from '../data/colors';
import {
  loadCosts,
  loadIncidents,
  loadMaintenance,
  loadSafety,
  loadWorkOrders,
} from '../data/fleetSources';

const fetchJson = async (url, { signal }) => {
  const response = await fetchOrThrow(url, { headers: { Accept: 'application/json' }, signal });
  return response.json();
};

// A widget's own time window, for widgets that need more history than the filter
// (e.g. a cost trend over the last six months).
export const windowRange = (window, range) => {
  if (window === 'months6' || window === 'months12') {
    const months = window === 'months6' ? 6 : 12;
    return {
      from: dayjs()
        .subtract(months - 1, 'month')
        .startOf('month'),
      to: dayjs().endOf('month'),
    };
  }
  return range;
};

const monthsBack = (range) => Math.min(24, Math.max(1, dayjs().diff(range.from, 'month') + 1));

// Rows of a dataset for a time range: { status, data, error, stale, fleet? }.
// status: idle | loading | success | error | fleet (database unavailable or no permission)
export const useSourceRows = (ds, source, range, enabled = true) => {
  const context = useDashboardData();
  const { liveRows, expiryRows, deviceIds, scope } = context;
  const dataset = DATASETS[ds];
  const fleetStatus = useFleetStatus();
  const permitted = useFleetPermission(dataset?.fleet ?? 'none');
  const positions = useSelector((state) => (ds === 'maintenance' ? state.session.positions : null));

  const from = toIso(range.from);
  const to = toIso(range.to);
  let key = null;
  let loader = null;
  if (enabled && dataset) {
    if (dataset.fleet && !permitted) {
      key = null;
    } else if (['summary', 'trips', 'stops', 'events'].includes(ds)) {
      key = `${source.key}|${from}|${to}|${scope}`;
      loader = (signal) => {
        checkSize(source.key, deviceIds.length, days(range));
        return fetchReport({
          endpoint: source.endpoint,
          from,
          to,
          deviceIds,
          params: source.params,
          signal,
          fetchJson,
        });
      };
    } else if (ds === 'safety') {
      key = `safety|${from}|${to}|${scope}`;
      loader = (signal) => {
        checkSize('trips', deviceIds.length, days(range));
        return loadSafety(deviceIds, range.from, range.to, signal);
      };
    } else if (ds === 'costs') {
      const months = monthsBack(range);
      key = `costs|${months}`;
      loader = () => loadCosts(months);
    } else if (ds === 'workOrders') {
      key = 'workOrders';
      loader = loadWorkOrders;
    } else if (ds === 'incidents') {
      key = 'incidents';
      loader = loadIncidents;
    } else if (ds === 'maintenance') {
      key = `maintenance|${scope}`;
      loader = (signal) => loadMaintenance(deviceIds, signal);
    }
  }
  const snapshot = useCachedQuery(key, loader);

  return useMemo(() => {
    if (!enabled || !dataset) {
      return { status: 'idle' };
    }
    if (ds === 'live') {
      return { status: 'success', data: liveRows };
    }
    if (ds === 'expiries') {
      return { status: 'success', data: expiryRows };
    }
    if (dataset.fleet && !permitted) {
      return { status: fleetStatus === 'loading' || fleetStatus === 'idle' ? 'loading' : 'fleet' };
    }
    if (snapshot.status === 'error') {
      return {
        status: snapshot.error?.name === 'TooLargeError' ? 'tooLarge' : 'error',
        error: snapshot.error,
        data: snapshot.data,
      };
    }
    if (snapshot.data === undefined) {
      return { status: 'loading' };
    }
    let data = snapshot.data;
    if (ds === 'summary' && source.key === 'trips') {
      data = data.map(tripAsSummary);
    }
    if (ds === 'maintenance') {
      data = data.map(({ deviceId, maintenance }) => ({
        deviceId,
        maintenance,
        maintenanceStatus: maintenanceStatus(maintenance, positions?.[deviceId]).status,
      }));
    }
    if (dataset.fleet && context.scoped) {
      const inScope = new Set(deviceIds);
      data = data.filter((row) => row.deviceId == null || inScope.has(row.deviceId));
    }
    return { status: 'success', data, stale: snapshot.status === 'loading' };
  }, [
    enabled,
    dataset,
    ds,
    liveRows,
    expiryRows,
    permitted,
    fleetStatus,
    snapshot,
    source.key,
    positions,
    deviceIds,
    context.scoped,
  ]);
};

// Rows of fleet datasets are filtered to the period here (Traccar reports already are).
const inRange = (rows, dataset, measure, range, monthly) => {
  if (!dataset.time || dataset.report || measure?.current) {
    return rows;
  }
  const from = (monthly ? range.from.startOf('month') : range.from).valueOf();
  const to = range.to.valueOf();
  return rows.filter((row) => {
    const time = dataset.time(row);
    return Number.isFinite(time) && time >= from && time <= to;
  });
};

// Private periods in a range, for the private-share metric (REP-06); cached like report rows.
const usePrivatePeriods = (range, enabled) => {
  const ready = useFleetStatus() === 'ready';
  const key =
    enabled && ready && range ? `privacy|${range.from.valueOf()}|${range.to.valueOf()}` : null;
  const snapshot = useCachedQuery(key, () => loadPrivacy(range.from.valueOf(), range.to.valueOf()));
  return snapshot.status === 'success' ? snapshot.data?.periods || [] : [];
};

const useAggregateContext = (range, measure) => {
  const devices = useSelector((state) => state.devices.items);
  const policy = useSelector((state) => state.fleet.privacy?.policy);
  const { deviceIds } = useDashboardData();
  const privatePeriods = usePrivatePeriods(range, Boolean(measure?.needsPrivacy));
  return useMemo(
    () => ({
      groupOf: (row) => row.groupId ?? devices[row.deviceId]?.groupId ?? 0,
      categoryOf: (deviceId) => devices[deviceId]?.category,
      // REP-06: fuel type for CO2, working hours for after-hours driving, private periods,
      // and the vehicles and days of the window for active vehicle-days.
      fuelTypeOf: (deviceId) => devices[deviceId]?.attributes?.fuelType,
      workPolicy: policy || DEFAULT_POLICY,
      privatePeriods,
      vehicleCount: deviceIds?.length ?? Object.keys(devices).length,
      rangeDays: range ? Math.max(1, Math.round(range.to.diff(range.from, 'day', true))) : null,
    }),
    [devices, policy, privatePeriods, deviceIds, range],
  );
};

// Data model of a chart widget for a resolved query.
export const useWidgetData = (query, { topN } = {}) => {
  const { range: filterRange } = useDashboardData();
  const dataset = DATASETS[query.ds];
  const measure = measureOf(query.ds, query.m);
  const dimension = dimensionOf(query.d);
  const breakdown = dimensionOf(query.b);
  const range = windowRange(query.w, filterRange);
  const base = useAggregateContext(range, measure);
  const timeAxis = dimension?.type === 'time';
  const bucket = dimension?.bucket ?? bucketFor(range);
  const source = sourceOf(query.ds, { timeAxis, bucket });
  const rows = useSourceRows(query.ds, source, range);

  const model = useMemo(() => {
    if (rows.status !== 'success' || !measure) {
      return null;
    }
    const monthly = query.ds === 'costs';
    const data = inRange(rows.data, dataset, measure, range, monthly);
    return aggregate(
      data,
      {
        dimension,
        measure,
        breakdown,
        topN: topN ?? query.n,
        sort: query.s,
        bucket,
        buckets: timeAxis ? timeBuckets(range, bucket, dayjs()) : null,
      },
      { ...base, timeOf: dataset.time },
    );
  }, [
    rows,
    measure,
    dataset,
    range,
    dimension,
    breakdown,
    topN,
    query.n,
    query.s,
    query.ds,
    bucket,
    timeAxis,
    base,
  ]);

  return { ...rows, model, measure, dimension, breakdown, bucket, range };
};

// One KPI: value, value of the comparable earlier period, change, and a trend line.
export const useMetric = (metric, { compare = false, spark = true } = {}) => {
  const { range, previous, liveHistory } = useDashboardData();
  const [ds, m] = metric.split('.');
  const dataset = DATASETS[ds];
  const measure = measureOf(ds, m);
  const base = useAggregateContext(range, measure);
  const bucket = bucketFor(range);
  const current = useSourceRows(ds, sourceOf(ds), range);
  const withCompare = compare && Boolean(dataset?.report);
  const before = useSourceRows(ds, sourceOf(ds), previous, withCompare);
  const timed = Boolean(dataset?.time) && spark;
  const trendSource = sourceOf(ds, { timeAxis: true, bucket });
  const trend = useSourceRows(ds, trendSource, range, timed && Boolean(dataset?.report));

  return useMemo(() => {
    if (!measure) {
      return { status: 'error' };
    }
    const ctx = { ...base, timeOf: dataset.time };
    const valueOf = (rows, window) =>
      rows.status === 'success'
        ? aggregate(inRange(rows.data, dataset, measure, window, ds === 'costs'), { measure }, ctx)
            .value
        : null;
    const value = valueOf(current, range);
    const previousValue = withCompare ? valueOf(before, previous) : null;
    let points = null;
    if (timed && trend.status === 'success') {
      points = aggregate(
        trend.data,
        {
          dimension: { type: 'time' },
          measure,
          bucket,
          buckets: timeBuckets(range, bucket, dayjs()),
        },
        ctx,
      ).points.filter((point) => !point.future);
    } else if (ds === 'live' && liveHistory?.[m]) {
      points = liveHistory[m];
    }
    return {
      status: current.status,
      stale: current.stale,
      error: current.error,
      value,
      previous: previousValue,
      delta: withCompare ? delta(value, previousValue) : null,
      points,
      measure,
    };
  }, [
    measure,
    base,
    dataset,
    current,
    range,
    withCompare,
    before,
    previous,
    timed,
    trend,
    bucket,
    ds,
    liveHistory,
    m,
  ]);
};

// Sticky color slots across renders for a categorical model.
export const useSlots = (keys) => {
  const previousRef = useRef({});
  const signature = keys.join('|');
  return useMemo(() => {
    const slots = assignSlots(keys, previousRef.current);
    previousRef.current = slots;
    return slots;
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [signature]);
};
