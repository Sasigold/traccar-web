import { getFleetClient, unwrap } from '../common/fleet/client';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { DEFAULT_HOURS_RULES, DEFAULT_SCORE_WEIGHTS } from '../common/fleet/safety';

const reportQuery = (deviceIds, from, to, extra = []) => {
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  deviceIds.forEach((id) => query.append('deviceId', id));
  extra.forEach(([key, value]) => query.append(key, value));
  return query.toString();
};

const json = async (url, signal) => {
  const response = await fetchOrThrow(url, { headers: { Accept: 'application/json' }, signal });
  return response.json();
};

// Traccar trips and safety events for the period, all visible vehicles.
export const loadDriving = async (deviceIds, from, to, signal) => {
  if (!deviceIds.length) {
    return { trips: [], events: [] };
  }
  const [trips, events] = await Promise.all([
    json(`api/reports/trips?${reportQuery(deviceIds, from, to)}`, signal),
    json(
      `api/reports/events?${reportQuery(deviceIds, from, to, [
        ['type', 'deviceOverspeed'],
        ['type', 'alarm'],
      ])}`,
      signal,
    ),
  ]);
  return { trips, events };
};

// Assignment history from the fleet database: who had which vehicle when, by Traccar ids.
export const loadAssignments = async () => {
  const rows = unwrap(
    await getFleetClient()
      .from('vehicle_driver_assignments')
      .select('starts_at, ends_at, vehicles(traccar_device_id), drivers(traccar_driver_id)'),
  );
  return (rows || [])
    .filter((row) => row.vehicles?.traccar_device_id && row.drivers?.traccar_driver_id)
    .map((row) => ({
      deviceId: row.vehicles.traccar_device_id,
      driverId: row.drivers.traccar_driver_id,
      start: Date.parse(row.starts_at),
      end: row.ends_at ? Date.parse(row.ends_at) : Infinity,
    }));
};

// (deviceId, moment) -> Traccar driver uniqueId from the assignment history.
export const assignmentResolver = (assignments, driversById) => (deviceId, moment) => {
  const match = assignments.find(
    (row) => row.deviceId === deviceId && row.start <= moment && moment < row.end,
  );
  return match ? driversById[match.driverId]?.uniqueId || null : null;
};

// Organization settings merged over the defaults.
export const loadSafetySettings = async () => {
  const { data } = await getFleetClient().from('org_safety_settings').select('*').maybeSingle();
  return {
    weights: { ...DEFAULT_SCORE_WEIGHTS, ...(data?.score_weights || {}) },
    rules: { ...DEFAULT_HOURS_RULES, ...(data?.hours_rules || {}) },
  };
};

// Who drove the vehicle at a moment: the identified driver of the trip, else the assignment.
export const whoDrove = async (deviceId, moment, driversByUniqueId, driversById) => {
  const from = new Date(moment - 6 * 3600000);
  const to = new Date(moment + 3600000);
  const trips = await json(`api/reports/trips?${reportQuery([deviceId], from, to)}`);
  const trip = trips.find(
    (item) =>
      Date.parse(item.startTime) <= moment + 15 * 60000 &&
      moment - 15 * 60000 <= Date.parse(item.endTime),
  );
  if (trip?.driverUniqueId && driversByUniqueId[trip.driverUniqueId]) {
    return driversByUniqueId[trip.driverUniqueId];
  }
  const resolve = assignmentResolver(await loadAssignments(), driversById);
  const uniqueId = resolve(deviceId, moment);
  return uniqueId ? driversByUniqueId[uniqueId] : null;
};
