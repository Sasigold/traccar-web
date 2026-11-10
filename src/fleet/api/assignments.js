import { unwrap } from '../../common/fleet/client';
import fetchOrThrow from '../../common/util/fetchOrThrow';

// ADM-17: the one way a driver and a vehicle are linked, from the driver's page or the
// vehicle's. `client` is the fleet client.

// Who has the vehicle now (its open assignment), with the driver's row, or null.
export const vehicleHolder = async (client, traccarDeviceId) => {
  const rows = unwrap(
    await client
      .from('current_assignments')
      .select('*')
      .eq('traccar_device_id', traccarDeviceId)
      .order('starts_at', { ascending: false })
      .limit(1),
  );
  const assignment = (rows || [])[0];
  if (!assignment) return null;
  const driver = unwrap(
    await client
      .from('drivers')
      .select('id, full_name, traccar_driver_id, profile_id')
      .eq('id', assignment.driver_id)
      .maybeSingle(),
  );
  return { ...assignment, driver };
};

const endOpen = async (client, column, id, now) =>
  unwrap(
    await client
      .from('vehicle_driver_assignments')
      .update({ ends_at: now })
      .eq(column, id)
      .or(`ends_at.is.null,ends_at.gt.${now}`),
  );

// The driver's assignment ends; with a vehicle, the vehicle passes to them (whoever had it
// stops having it, so a vehicle has one permanent driver at a time).
export const assignDriver = async ({ client, profile, driverId, vehicleId }) => {
  const now = new Date().toISOString();
  await endOpen(client, 'driver_id', driverId, now);
  if (!vehicleId) return;
  await endOpen(client, 'vehicle_id', vehicleId, now);
  unwrap(
    await client.from('vehicle_driver_assignments').insert({
      org_id: profile.org_id,
      vehicle_id: vehicleId,
      driver_id: driverId,
      starts_at: now,
      is_primary: true,
      created_by: profile.id,
    }),
  );
};

// The driver's own user sees the vehicle on the map (a Traccar user ↔ device link). Already
// linked counts as done. Returns whether the link is there.
export const grantMapAccess = async (traccarUserId, deviceId) => {
  if (!traccarUserId || !deviceId) return false;
  try {
    await fetchOrThrow('api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(traccarUserId), deviceId: Number(deviceId) }),
    });
    return true;
  } catch (error) {
    return /duplicate|already|unique/i.test(`${error?.message || ''} ${error?.detail || ''}`);
  }
};

// The Traccar user of a driver's linked profile, if any.
export const linkedTraccarUser = async (client, profileId) => {
  if (!profileId) return null;
  const row = unwrap(
    await client.from('profiles').select('traccar_user_id').eq('id', profileId).maybeSingle(),
  );
  return row?.traccar_user_id ?? null;
};
