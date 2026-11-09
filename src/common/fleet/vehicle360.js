// The vehicle card's summary tiles (ADM-12): pure functions over rows the page loads.
import { maintenanceStatus, sortByUrgency } from './maintenanceStatus';

const OPEN_WORK_ORDERS = ['planned', 'open', 'in_shop'];

// The month's spending from vehicle_monthly_costs rows (month = 'YYYY-MM-01').
export const monthCost = (rows, month) =>
  Math.round(
    rows
      .filter((row) => String(row.month).slice(0, 7) === month.slice(0, 7))
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * 100,
  ) / 100;

export const openWorkOrders = (rows) => rows.filter((row) => OPEN_WORK_ORDERS.includes(row.status));

// The nearest validity date of this vehicle (from useExpiries rows).
export const nearestExpiry = (rows, deviceId) =>
  rows
    .filter((row) => row.entity === 'vehicle' && row.entityId === deviceId)
    .sort((a, b) => a.days - b.days)[0] || null;

// The most urgent Traccar maintenance for this vehicle, with its state.
export const nextMaintenance = (maintenances, position, now = Date.now()) => {
  const rows = maintenances.map((maintenance) => ({
    maintenance,
    state: maintenanceStatus(maintenance, position, now),
  }));
  return sortByUrgency(rows).find((row) => row.state.status !== 'unknown') || rows[0] || null;
};
