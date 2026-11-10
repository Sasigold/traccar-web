import { getFleetClient, unwrap } from '../../common/fleet/client';
import { periodStart } from '../../common/fleet/costs';
import { scoreDrivers } from '../../common/fleet/safety';
import { loadDriving, loadSafetySettings } from '../../fleet/safetyData';
import { loadMaintenanceLinks } from '../../fleet/maintenance';

// Loaders for fleet database widgets. Each returns flat rows carrying the Traccar
// `deviceId`, so the group filter and the vehicle dimension work like everywhere else.

export const MAINTENANCE_DEVICE_LIMIT = 200;

const vehicleIndex = async () => {
  const rows =
    unwrap(await getFleetClient().from('vehicles').select('id, traccar_device_id, plate_number')) ||
    [];
  return Object.fromEntries(rows.map((row) => [row.id, row.traccar_device_id]));
};

const withDevice = (rows, index) =>
  rows.map((row) => ({ ...row, deviceId: index[row.vehicle_id] ?? null }));

// Monthly costs from `months` months back (the view groups by month).
export const loadCosts = async (months) => {
  const [index, rows] = await Promise.all([
    vehicleIndex(),
    getFleetClient()
      .from('vehicle_monthly_costs')
      .select('vehicle_id, month, category, amount')
      .gte('month', periodStart(months))
      .then(unwrap),
  ]);
  return withDevice(rows || [], index).map((row) => ({
    ...row,
    category: row.category === 'fuel' || row.category === 'maintenance' ? row.category : 'other',
  }));
};

export const loadWorkOrders = async () => {
  const [index, rows] = await Promise.all([
    vehicleIndex(),
    getFleetClient()
      .from('work_orders')
      .select('id, status, type, total_cost, opened_at, created_at, vehicle_id')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(unwrap),
  ]);
  return withDevice(rows || [], index);
};

export const loadIncidents = async () => {
  const [index, rows] = await Promise.all([
    vehicleIndex(),
    getFleetClient()
      .from('incidents')
      .select('id, type, severity, status, occurred_at, repair_cost, vehicle_id')
      .order('occurred_at', { ascending: false })
      .limit(1000)
      .then(unwrap),
  ]);
  return withDevice(rows || [], index);
};

// Driver safety scores for the period (same scoring as /fleet/safety).
// SAF-01: the events dismissed in the safety inbox, which leave the score like on the safety page.
const loadDismissed = async (from) => {
  const { data } = await getFleetClient()
    .from('safety_event_reviews')
    .select('traccar_event_id')
    .eq('status', 'dismissed')
    .gte('occurred_at', from.toISOString());
  return new Set((data || []).map((row) => Number(row.traccar_event_id)));
};

export const loadSafety = async (deviceIds, from, to, signal) => {
  const [{ trips, events }, settings, excluded] = await Promise.all([
    loadDriving(deviceIds, from.toDate(), to.toDate(), signal),
    loadSafetySettings(),
    loadDismissed(from.toDate()).catch(() => new Set()),
  ]);
  return scoreDrivers(trips, events, { weights: settings.weights, excluded }).map((item) => ({
    driverUniqueId: item.driver,
    score: item.score,
    events: item.events,
    km: item.km,
  }));
};

export const loadMaintenance = async (deviceIds, signal) => {
  const { links } = await loadMaintenanceLinks(
    deviceIds.slice(0, MAINTENANCE_DEVICE_LIMIT),
    signal,
  );
  return links;
};
