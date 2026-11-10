import { afterHours } from '../../dashboard/data/fleetMetrics';
import { repeatedFaults } from './predict';

// AI-02: the morning's findings, at most four, ranked. Simple statistics on the fleet's own
// history (the last 28 days), not a model: a vehicle that stopped moving, fuel use that jumped,
// mileage far above its usual, trips outside working hours yesterday, fault codes now. Each
// finding says why and links to the evidence. Pure, unit-tested.

const DAY = 86400000;
const dayKey = (time) => new Date(time).toISOString().slice(0, 10);
const per100 = (fuel, distance) => (distance > 0 ? (fuel / distance) * 100000 : null);

// daily: summary rows with daily=true ({ deviceId, startTime, distance (m), spentFuel (l) }).
// trips: yesterday's trips. positions: the live positions (for fault codes).
export const computeInsights = (
  { daily = [], trips = [], positions = {}, devices = {}, policy = null, resolve = null },
  now = new Date(),
) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const recentFrom = today.getTime() - 7 * DAY;
  const findings = [];
  const name = (id) => devices[id]?.name ?? String(id);
  const range = (from, to) =>
    `from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`;

  const byDevice = new Map();
  daily.forEach((row) => {
    if (!devices[row.deviceId]) return;
    if (!byDevice.has(row.deviceId)) byDevice.set(row.deviceId, []);
    byDevice.get(row.deviceId).push(row);
  });

  byDevice.forEach((rows, deviceId) => {
    const time = (row) => new Date(row.startTime).getTime();
    const recent = rows.filter((row) => time(row) >= recentFrom);
    const before = rows.filter((row) => time(row) < recentFrom);
    const sum = (list, key) => list.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const baseDays = Math.max(new Set(before.map((row) => dayKey(row.startTime))).size, 1);
    const baseDaily = sum(before, 'distance') / baseDays;

    // Stopped: no distance for the last three days, after usually driving.
    const lastDrive = rows
      .filter((row) => Number(row.distance) > 500)
      .reduce((latest, row) => Math.max(latest, time(row)), 0);
    const idleDays = lastDrive ? Math.floor((today.getTime() - lastDrive) / DAY) : null;
    if (idleDays != null && idleDays >= 3 && baseDaily > 5000) {
      findings.push({
        id: `idle-${deviceId}`,
        kind: 'notMoving',
        deviceId,
        score: 50 + Math.min(idleDays, 14) * 3,
        values: { name: name(deviceId), days: idleDays },
        link: `/replay?deviceId=${deviceId}`,
      });
    }

    // Fuel per 100 km this week against the weeks before.
    const recentRate = per100(sum(recent, 'spentFuel'), sum(recent, 'distance'));
    const baseRate = per100(sum(before, 'spentFuel'), sum(before, 'distance'));
    if (
      recentRate != null &&
      baseRate != null &&
      sum(recent, 'distance') > 100000 &&
      recentRate > baseRate * 1.25 &&
      recentRate - baseRate >= 2
    ) {
      findings.push({
        id: `fuel-${deviceId}`,
        kind: 'fuelJump',
        deviceId,
        score: 40 + Math.min(((recentRate - baseRate) / baseRate) * 100, 60),
        values: {
          name: name(deviceId),
          now: recentRate.toFixed(1),
          before: baseRate.toFixed(1),
        },
        link: `/reports/summary?deviceId=${deviceId}&${range(recentFrom, now)}`,
      });
    }

    // Mileage: this week more than twice the usual week.
    const recentDistance = sum(recent, 'distance');
    if (baseDaily > 0 && recentDistance > 200000 && recentDistance > baseDaily * 7 * 2) {
      findings.push({
        id: `distance-${deviceId}`,
        kind: 'distanceJump',
        deviceId,
        score: 30 + Math.min(recentDistance / (baseDaily * 7), 10) * 3,
        values: {
          name: name(deviceId),
          now: Math.round(recentDistance / 1000),
          before: Math.round((baseDaily * 7) / 1000),
        },
        link: `/reports/trips?deviceId=${deviceId}&${range(recentFrom, now)}`,
      });
    }
  });

  // Yesterday outside working hours: one finding for the fleet.
  const outside = trips.filter(
    (trip) => devices[trip.deviceId] && afterHours(policy, trip.startTime),
  );
  if (outside.length) {
    const vehicles = [...new Set(outside.map((trip) => trip.deviceId))];
    const yesterday = today.getTime() - DAY;
    findings.push({
      id: 'after-hours',
      kind: 'afterHours',
      score: 35 + Math.min(outside.length, 10) * 2,
      values: { trips: outside.length, vehicles: vehicles.length, name: name(vehicles[0]) },
      link: `/reports/trips?${vehicles.map((id) => `deviceId=${id}`).join('&')}&${range(yesterday, today.getTime() - 1)}`,
    });
  }

  // SAF-02: yesterday's trips nobody is known to have driven.
  const unknown = trips.filter(
    (trip) =>
      devices[trip.deviceId] &&
      !(trip.driverUniqueId || resolve?.(trip.deviceId, Date.parse(trip.startTime))),
  );
  if (unknown.length) {
    const vehicles = [...new Set(unknown.map((trip) => trip.deviceId))];
    const yesterday = today.getTime() - DAY;
    findings.push({
      id: 'no-driver',
      kind: 'noDriver',
      score: 30 + Math.min(unknown.length, 10),
      values: { trips: unknown.length, vehicles: vehicles.length, name: name(vehicles[0]) },
      link: `/reports/trips?${vehicles.map((id) => `deviceId=${id}`).join('&')}&${range(yesterday, today.getTime() - 1)}`,
    });
  }

  // Fault codes reported now, grouped by code.
  const faults = new Map();
  Object.values(positions).forEach((position) => {
    if (!devices[position.deviceId]) return;
    String([position.attributes?.dtcs, position.attributes?.faults].filter(Boolean).join(','))
      .toUpperCase()
      .split(/[\s,;]+/)
      .filter((code) => /^[PBCU][0-9A-F]{4}$/.test(code))
      .forEach((code) => {
        if (!faults.has(code)) faults.set(code, []);
        faults.get(code).push(position.deviceId);
      });
  });
  faults.forEach((deviceIds, code) => {
    findings.push({
      id: `fault-${code}`,
      kind: deviceIds.length > 1 ? 'faultMany' : 'fault',
      deviceId: deviceIds[0],
      score: 45 + deviceIds.length * 5,
      values: { code, name: name(deviceIds[0]), vehicles: deviceIds.length },
      link: '/',
    });
  });

  // AI-06: the same code in three or more vehicles of one model is a pattern, not bad luck.
  const codes = [];
  faults.forEach((deviceIds, code) => {
    deviceIds.forEach((deviceId) => {
      codes.push({ deviceId, code, model: devices[deviceId]?.attributes?.vehicleModel });
    });
  });
  const patterns = repeatedFaults(codes);
  // The model finding says more than "the same code on several vehicles".
  const explained = new Set(patterns.map((group) => `fault-${group.code}`));
  for (let index = findings.length - 1; index >= 0; index -= 1) {
    if (explained.has(findings[index].id)) findings.splice(index, 1);
  }
  patterns.forEach((group) => {
    findings.push({
      id: `model-fault-${group.model}-${group.code}`,
      kind: 'modelFault',
      deviceId: group.deviceIds[0],
      score: 70 + group.count * 3,
      values: { code: group.code, model: group.model, vehicles: group.count },
      link: '/',
    });
  });

  return findings.sort((a, b) => b.score - a.score).slice(0, 4);
};
