import { getFleetClient } from './client';
import { isFleetConfigured } from './config';
import { getFleetAccessToken } from './session';

// ADM-05: when a device is deleted in Traccar, its fleet row is marked archived instead of being
// left without a vehicle, so work orders and documents keep their history. Best effort: without
// the fleet database, or without permission, the deletion in Traccar still stands.
export const archiveFleetVehicle = async (deviceId) => {
  if (!isFleetConfigured() || !getFleetAccessToken()) {
    return;
  }
  try {
    await getFleetClient()
      .from('vehicles')
      .update({ archived_at: new Date().toISOString() })
      .eq('traccar_device_id', Number(deviceId));
  } catch {
    // the device is gone from Traccar either way
  }
};
