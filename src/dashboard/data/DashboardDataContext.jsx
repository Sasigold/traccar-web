import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useAttributePreference } from '../../common/util/preferences';
import { fuelReading } from '../../common/components/telemetry/vehicleProfile';
import useExpiries from '../../fleet/useExpiries';
import { DATASETS, liveRow } from './datasets';
import { reduceMeasure } from './aggregate';
import { bucketFor, periodRange, previousRange } from './periods';
import { createQueryCache } from './queryCache';
import { scopeDeviceIds, scopeKey } from './scope';

// One cache for the whole app, so data survives leaving and reopening the dashboard.
const cache = createQueryCache();

const LIVE_THROTTLE = 2000;
const IDLE = { status: 'idle', data: undefined, error: null, stale: false, updatedAt: 0 };

const DashboardDataContext = createContext(null);

// Samples of the live counts (every 30 s, last hour) per scope, kept across visits,
// so live KPIs and the hero tile can draw a short trend line.
const SAMPLE_EVERY = 30000;
const SAMPLE_LIMIT = 120;
const liveSamples = new Map();

const projectSamples = (list) =>
  Object.fromEntries(
    Object.keys(DATASETS.live.measures).map((measure) => [
      measure,
      list.map((sample) => ({ key: sample.t, value: sample.values[measure] })),
    ]),
  );

const useLiveHistory = (scope, rows, time) => {
  const [history, setHistory] = useState(() => projectSamples(liveSamples.get(scope) ?? []));
  useEffect(() => {
    if (!rows.length || !time) {
      return;
    }
    const list = liveSamples.get(scope) ?? [];
    if (list.length && time - list.at(-1).t < SAMPLE_EVERY) {
      return;
    }
    const values = Object.fromEntries(
      Object.entries(DATASETS.live.measures).map(([key, measure]) => [
        key,
        reduceMeasure(rows, measure),
      ]),
    );
    list.push({ t: time, values });
    liveSamples.set(scope, list.slice(-SAMPLE_LIMIT));
    setHistory(projectSamples(liveSamples.get(scope)));
  }, [scope, rows, time]);
  return history;
};

export const useDashboardData = () => use(DashboardDataContext);

// Live rows for the vehicles in scope, recomputed at most every two seconds.
const useLiveRows = (deviceIds, speedUnit) => {
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const [state, setState] = useState(() => ({ rows: [], time: 0 }));
  const lastRef = useRef(0);
  const timerRef = useRef(null);
  const inputsRef = useRef();
  inputsRef.current = { devices, positions, deviceIds, speedUnit };

  const compute = useCallback(() => {
    const {
      devices: items,
      positions: latest,
      deviceIds: ids,
      speedUnit: unit,
    } = inputsRef.current;
    const now = Date.now();
    lastRef.current = now;
    timerRef.current = null;
    const rows = ids
      .map((id) => items[id])
      .filter(Boolean)
      .map((device) =>
        liveRow(
          device,
          latest[device.id],
          now,
          unit,
          (position, item) => fuelReading(position, item)?.ratio ?? null,
        ),
      );
    setState({ rows, time: now });
  }, []);

  useEffect(() => {
    const wait = LIVE_THROTTLE - (Date.now() - lastRef.current);
    if (wait <= 0) {
      compute();
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(compute, wait);
    }
  }, [devices, positions, deviceIds, speedUnit, compute]);

  useEffect(() => () => clearTimeout(timerRef.current), []);
  return state;
};

export const DashboardDataProvider = ({ filters, onFilters, refresh = 0, children }) => {
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items);
  const speedUnit = useAttributePreference('speedUnit', 'kmh');

  const ids = scopeDeviceIds(devices, groups, filters.groupIds);
  const key = scopeKey(ids);
  // eslint-disable-next-line @eslint-react/exhaustive-deps
  const deviceIds = useMemo(() => ids, [key]);

  // "Today" moves on at midnight; the clock ticks every minute.
  const [clock, setClock] = useState(() => dayjs());
  useEffect(() => {
    const interval = setInterval(() => setClock(dayjs()), 60000);
    return () => clearInterval(interval);
  }, []);
  const day = clock.format('YYYY-MM-DD');

  const range = useMemo(
    () => periodRange(filters.period, dayjs(), filters),
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [filters.period, filters.from, filters.to, filters.offset, day],
  );
  const previous = useMemo(
    () => previousRange(filters.period, range, dayjs()),
    [filters.period, range],
  );
  const bucket = bucketFor(range);

  // Auto refresh while the page is visible; "refresh now" reloads everything.
  const [token, setToken] = useState(0);
  useEffect(() => {
    if (!refresh) {
      return undefined;
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setToken((value) => value + 1);
      }
    }, refresh * 1000);
    return () => clearInterval(interval);
  }, [refresh]);
  const refreshNow = useCallback(() => {
    cache.invalidate();
    setToken((value) => value + 1);
  }, []);

  const live = useLiveRows(deviceIds, speedUnit);
  const liveHistory = useLiveHistory(key, live.rows, live.time);
  const { rows: expiryRows } = useExpiries();
  const scopedExpiries = useMemo(() => {
    if (!filters.groupIds.length) {
      return expiryRows;
    }
    const inScope = new Set(deviceIds);
    return expiryRows.filter((row) => row.entity !== 'vehicle' || inScope.has(row.entityId));
  }, [expiryRows, deviceIds, filters.groupIds.length]);

  const value = useMemo(
    () => ({
      filters,
      range,
      previous,
      bucket,
      deviceIds,
      scope: key,
      liveRows: live.rows,
      liveTime: live.time,
      liveHistory,
      expiryRows: scopedExpiries,
      cache,
      token,
      refresh,
      refreshNow,
      speedUnit,
      setFilters: onFilters,
    }),
    [
      filters,
      range,
      previous,
      bucket,
      deviceIds,
      key,
      live,
      liveHistory,
      scopedExpiries,
      token,
      refresh,
      refreshNow,
      speedUnit,
      onFilters,
    ],
  );

  return <DashboardDataContext value={value}>{children}</DashboardDataContext>;
};

// Cached, shared async data; `key` null means disabled.
export const useCachedQuery = (key, loader) => {
  const { cache: store, token, refresh } = useDashboardData();
  const subscribe = useCallback(
    (listener) => (key ? store.subscribe(key, listener) : () => {}),
    [store, key],
  );
  const getSnapshot = useCallback(() => (key ? store.get(key) : IDLE), [store, key]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    if (key) {
      const maxAge = refresh ? refresh * 1000 - 1000 : 5 * 60000;
      store.ensure(key, (signal) => loaderRef.current(signal), { maxAge });
    }
  }, [store, key, token, refresh]);
  return snapshot;
};

// Time of the newest data on screen, for the "SYNCED / 14:32" label.
export const useLastSynced = () => {
  const { cache: store, liveTime, token } = useDashboardData();
  const [time, setTime] = useState(0);
  useEffect(() => {
    const update = () => setTime(Math.max(store.latestUpdate(), liveTime));
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [store, liveTime, token]);
  return time;
};
