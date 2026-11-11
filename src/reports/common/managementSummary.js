// REP-16 / REP-23: the month for the management summary, from the reports the app already has.
// Pure, unit-tested.

const pad = (value) => String(value).padStart(2, '0');

// "2026-10" -> the month's first and last moment, local time, as ISO strings.
/** @param {string} month */
export const monthRange = (month) => {
  const [year, index] = month.split('-').map(Number);
  const from = new Date(year, index - 1, 1);
  const to = new Date(year, index, 1, 0, 0, 0, -1);
  return { from: from.toISOString(), to: to.toISOString() };
};

// The month before "2026-01" is "2025-12".
/** @param {string} month */
export const previousMonth = (month) => {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 2, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

// The last whole month: the summary is written after the month ends.
export const lastMonth = (now = new Date()) => {
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

/**
 * The fleet's month from Traccar's summary: distance (m), engine hours (ms), fuel (l), the
 * vehicles that moved, and the vehicles by distance.
 * @param {{ deviceId: number, distance?: number, engineHours?: number, spentFuel?: number }[]} rows
 * @param {{ id: number, name: string }[]} devices
 */
export const fleetMonth = (rows, devices) => {
  const byDevice = new Map();
  (rows || []).forEach((row) => {
    const current = byDevice.get(row.deviceId) || { distance: 0, engineHours: 0, spentFuel: 0 };
    current.distance += row.distance || 0;
    current.engineHours += row.engineHours || 0;
    current.spentFuel += row.spentFuel || 0;
    byDevice.set(row.deviceId, current);
  });
  const vehicles = devices
    .map((device) => ({
      deviceId: device.id,
      name: device.name,
      ...(byDevice.get(device.id) || { distance: 0, engineHours: 0, spentFuel: 0 }),
    }))
    .sort((a, b) => b.distance - a.distance);
  const total = (key) => vehicles.reduce((sum, vehicle) => sum + vehicle[key], 0);
  return {
    distance: total('distance'),
    engineHours: total('engineHours'),
    spentFuel: total('spentFuel'),
    active: vehicles.filter((vehicle) => vehicle.distance > 0).length,
    count: vehicles.length,
    vehicles,
  };
};

// Events by kind: speeding, alarms and all.
/** @param {{ type: string }[]} events */
export const eventCounts = (events) => ({
  all: (events || []).length,
  speeding: (events || []).filter((event) => event.type === 'deviceOverspeed').length,
  alarms: (events || []).filter((event) => event.type === 'alarm').length,
});

// The fleet database's costs for the month, by category: { fuel, maintenance, other, total }.
/** @param {{ month: string, category: string, amount: number }[]} rows @param {string} month */
export const monthCosts = (rows, month) => {
  const result = { fuel: 0, maintenance: 0, other: 0, total: 0 };
  (rows || [])
    .filter((row) => String(row.month).slice(0, 7) === month)
    .forEach((row) => {
      const amount = Number(row.amount) || 0;
      const key =
        row.category === 'fuel' || row.category === 'maintenance' ? row.category : 'other';
      result[key] += amount;
      result.total += amount;
    });
  return result;
};
