// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// Fleet reports (REP-23): usage, cost per km and device health, per vehicle. Pure, unit-tested.
import {
  DEFAULT_POLICY,
  inPrivatePeriod,
  isWorkTime,
  localParts,
} from '../../common/fleet/privacy';

const HOUR = 60 * 60 * 1000;
const sum = (rows, value) => rows.reduce((total, row) => total + (Number(value(row)) || 0), 0);

// Usage: how much each vehicle was used, idling and its cost, after hours, rest days, private.
// `idleBurn` liters per idle hour and `fuelPrice` per liter come from the user; without a price
// there is no cost.
export const usageByVehicle = (
  devices,
  trips,
  stops,
  { policy = DEFAULT_POLICY, periods = [], days, idleBurn, fuelPrice },
) =>
  devices.map((device) => {
    const own = trips.filter((trip) => trip.deviceId === device.id);
    const ownStops = stops.filter((stop) => stop.deviceId === device.id);
    const restDay = (trip) =>
      !(policy.work_days || []).includes(localParts(trip.startTime, policy.timezone).day);
    const activeDays = new Set(
      own.filter((trip) => trip.distance > 0).map((trip) => String(trip.startTime).slice(0, 10)),
    ).size;
    const idleTime = sum(ownStops, (stop) => stop.engineHours);
    const idleCost =
      Number(fuelPrice) > 0 && Number(idleBurn) > 0
        ? (idleTime / HOUR) * Number(idleBurn) * Number(fuelPrice)
        : null;
    return {
      deviceId: device.id,
      name: device.name,
      distance: sum(own, (trip) => trip.distance),
      drivingTime: sum(own, (trip) => trip.duration),
      activeDays,
      utilization: days ? (100 * activeDays) / days : null,
      idleTime,
      idleCost,
      afterHoursDistance: sum(
        own.filter((trip) => !restDay(trip) && !isWorkTime(policy, trip.startTime)),
        (trip) => trip.distance,
      ),
      restDayDistance: sum(own.filter(restDay), (trip) => trip.distance),
      privateDistance: sum(
        own.filter((trip) => inPrivatePeriod(periods, trip.deviceId, trip.startTime)),
        (trip) => trip.distance,
      ),
    };
  });

// Cost per km: the fleet database's costs over Traccar's distance for the same months.
export const costPerKmByVehicle = (devices, summary, costs) =>
  devices.map((device) => {
    const meters = sum(
      summary.filter((row) => row.deviceId === device.id),
      (row) => row.distance,
    );
    const own = costs.filter((row) => row.deviceId === device.id);
    const bucket = (category) =>
      sum(
        own.filter((row) =>
          category === 'other'
            ? !['fuel', 'maintenance'].includes(row.category)
            : row.category === category,
        ),
        (row) => row.amount,
      );
    const fuel = bucket('fuel');
    const maintenance = bucket('maintenance');
    const other = bucket('other');
    const total = fuel + maintenance + other;
    const km = meters / 1000;
    return {
      deviceId: device.id,
      name: device.name,
      distance: meters,
      fuel,
      maintenance,
      other,
      total,
      perKm: km > 0 && total > 0 ? total / km : null,
    };
  });

const DTC_SPLIT = /[\s,;]+/;

// Device health: silent devices, power cuts, low battery and engine fault codes, worst first.
export const deviceHealth = (devices, positions, events, now = Date.now()) =>
  devices
    .map((device) => {
      const last = device.lastUpdate ? Date.parse(device.lastUpdate) : null;
      const silentHours = last ? (now - last) / HOUR : null;
      const own = events.filter((event) => event.deviceId === device.id);
      const alarms = (name) =>
        own.filter((event) => event.type === 'alarm' && event.attributes?.alarm === name).length;
      const dtcs = String(positions[device.id]?.attributes?.dtcs || '')
        .split(DTC_SPLIT)
        .filter(Boolean);
      const powerCuts = alarms('powerCut');
      const lowBattery = alarms('lowBattery');
      const silent = silentHours == null || silentHours > 24;
      return {
        deviceId: device.id,
        name: device.name,
        lastUpdate: device.lastUpdate || null,
        silentHours,
        silent,
        powerCuts,
        lowBattery,
        dtcs,
        issues:
          (silent ? 1 : 0) + (powerCuts ? 1 : 0) + (lowBattery ? 1 : 0) + (dtcs.length ? 1 : 0),
      };
    })
    .sort(
      (a, b) => b.issues - a.issues || (b.silentHours ?? Infinity) - (a.silentHours ?? Infinity),
    );

// OPS-04: vehicles used on fewer than `threshold` percent of the days, and what returning one
// (the least used) would save a month, when the monthly cost of a vehicle is known.
export const underusedVehicles = (rows, { threshold = 20, monthlyCost } = {}) => {
  const under = rows
    .filter((row) => row.utilization != null && row.utilization < threshold)
    .sort((a, b) => a.utilization - b.utilization);
  const cost = Number(monthlyCost);
  return {
    vehicles: under,
    savings: under.length && cost > 0 ? cost : null,
  };
};

// OPS-04: engine hours per active day, from the summary's engine hours (ms).
export const engineHoursPerDay = (summary, deviceId, activeDays) => {
  const ms = sum(
    summary.filter((row) => row.deviceId === deviceId),
    (row) => row.engineHours,
  );
  return activeDays > 0 ? ms / HOUR / activeDays : null;
};

// OPS-04: each vehicle's distance against the median of its group (100 = like the group's
// middle vehicle); null for a vehicle alone in its group or without a group.
export const groupComparison = (rows, groupOf) => {
  const byGroup = new Map();
  rows.forEach((row) => {
    const group = groupOf(row.deviceId);
    if (!group) return;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(row.distance || 0);
  });
  const medians = new Map(
    [...byGroup.entries()].map(([group, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      return [group, { median, size: values.length }];
    }),
  );
  return rows.map((row) => {
    const entry = medians.get(groupOf(row.deviceId));
    if (!entry || entry.size < 2 || !entry.median) return null;
    return Math.round(((row.distance || 0) / entry.median) * 100);
  });
};
