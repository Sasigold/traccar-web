import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { computeInsights } from '../common/fleet/insights';
import { useRestriction } from '../common/util/permissions';
import { useFleetReady } from '../common/fleet/useFleet';
import { assignmentResolver, loadAssignments } from '../fleet/safetyData';

// AI-02: the morning findings, shared by the map's insights and the dashboard widget: loaded
// once a day per user (kept for the session), after the screen has settled.

const DAY = 86400000;
export const todayKey = () => new Date().toLocaleDateString('en-CA');

// The fleet's last 28 days by day, and yesterday's trips: two report requests, once a day.
const loadFindings = async (devices, positions, drivers, fleetReady, signal) => {
  const ids = Object.keys(devices);
  if (!ids.length) return [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const query = (from, to, extra = {}) => {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      ...extra,
    });
    ids.forEach((id) => params.append('deviceId', id));
    return params;
  };
  const get = async (path, params) =>
    (
      await fetchOrThrow(`api/reports/${path}?${params}`, {
        signal,
        headers: { Accept: 'application/json' },
      })
    ).json();
  const [daily, trips] = await Promise.all([
    get('summary', query(new Date(today.getTime() - 28 * DAY), now, { daily: 'true' })),
    get('trips', query(new Date(today.getTime() - DAY), new Date(today.getTime() - 1))),
  ]);
  // SAF-02: assigned drivers count as known (fleet database, when there is one).
  let resolve = null;
  if (fleetReady) {
    const byId = Object.fromEntries(Object.values(drivers).map((driver) => [driver.id, driver]));
    resolve = assignmentResolver(await loadAssignments().catch(() => []), byId);
  }
  return computeInsights({ daily, trips, positions, devices, resolve }, now);
};

export const useMorningFindings = ({ skip = false, delay = 2500 } = {}) => {
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const drivers = useSelector((state) => state.drivers.items);
  const fleetReady = useFleetReady();
  const userId = useSelector((state) => state.session.user?.id);
  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const deviceCount = Object.keys(devices).length;
  const [findings, setFindings] = useState(null);

  useEffect(() => {
    if (skip || readonly || disableReports || !deviceCount) return undefined;
    const key = `morningInsights:${userId}:${todayKey()}`;
    const cached = window.sessionStorage.getItem(key);
    if (cached) {
      setFindings(JSON.parse(cached));
      return undefined;
    }
    const controller = new AbortController();
    // After the screen has settled: the findings are not urgent.
    const timer = setTimeout(() => {
      loadFindings(devices, positions, drivers, fleetReady, controller.signal)
        .then((result) => {
          window.sessionStorage.setItem(key, JSON.stringify(result));
          setFindings(result);
        })
        .catch(() => {});
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Once per day and fleet size, not on every position.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [skip, readonly, disableReports, deviceCount, userId]);

  return findings;
};

// A finding's title or reason in words ("Title" or "Why"); one vehicle reads differently.
export const useInsightText = () => {
  const t = useTranslation();
  return (finding, part) => {
    const one = finding.values.vehicles === 1 ? t(`insight${part}_${finding.kind}One`) : null;
    let value = one || t(`insight${part}_${finding.kind}`);
    Object.entries(finding.values).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, replacement);
    });
    return value;
  };
};
