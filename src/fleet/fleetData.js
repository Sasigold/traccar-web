import { useState } from 'react';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useAsyncTask } from '../reactHelper';
import { saveFleetRecord } from './fleetRecords';

export const FILES_BUCKET = 'fleet-files';

const safeName = (name) => name.replace(/[^\w.-]+/g, '_').slice(-80);

// <org>/<area>/<uuid>-<name>; the area (work-orders, incidents, inspections, expenses) picks
// the storage permission, see fleet_file_permission() in the stage 2 migration.
export const uploadFleetFile = async (orgId, area, file) => {
  const path = `${orgId}/${area}/${crypto.randomUUID()}-${safeName(file.name)}`;
  unwrap(
    await getFleetClient()
      .storage.from(FILES_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }),
  );
  return path;
};

export const openFleetFile = async (path) => {
  const { signedUrl } = unwrap(
    await getFleetClient().storage.from(FILES_BUCKET).createSignedUrl(path, 120),
  );
  window.open(signedUrl, '_blank', 'noopener');
};

export const fleetFileUrl = async (path) =>
  unwrap(await getFleetClient().storage.from(FILES_BUCKET).createSignedUrl(path, 600)).signedUrl;

// The fleet database row of a Traccar device, created from the card details when missing.
export const ensureVehicle = async (device, profile) => {
  const client = getFleetClient();
  const existing = unwrap(
    await client.from('vehicles').select('id').eq('traccar_device_id', device.id).maybeSingle(),
  );
  if (existing) {
    return existing.id;
  }
  const row = await saveFleetRecord('vehicle', device, profile, {
    withDocuments: false,
    keepExisting: true,
  });
  return row.id;
};

export const ensureDriver = async (driver, profile) => {
  const client = getFleetClient();
  const existing = unwrap(
    await client.from('drivers').select('id').eq('traccar_driver_id', driver.id).maybeSingle(),
  );
  if (existing) {
    return existing.id;
  }
  const row = await saveFleetRecord('driver', driver, profile, {
    withDocuments: false,
    keepExisting: true,
  });
  return row.id;
};

// vehicles.id -> { traccarId, plate }, for showing database rows by their Traccar vehicle.
export const useVehicleIndex = (enabled) => {
  const [index, setIndex] = useState({});
  useAsyncTask(async () => {
    if (!enabled) {
      return;
    }
    const rows = unwrap(
      await getFleetClient().from('vehicles').select('id, traccar_device_id, plate_number'),
    );
    setIndex(
      Object.fromEntries(
        (rows || []).map((row) => [
          row.id,
          { traccarId: row.traccar_device_id, plate: row.plate_number },
        ]),
      ),
    );
  }, [enabled]);
  return index;
};

export const useVendors = (enabled, reloadKey = 0) => {
  const [vendors, setVendors] = useState([]);
  useAsyncTask(async () => {
    void reloadKey;
    if (!enabled) {
      return;
    }
    setVendors(unwrap(await getFleetClient().from('vendors').select('*').order('name')) || []);
  }, [enabled, reloadKey]);
  return vendors;
};

export const money = (value) =>
  value == null || value === ''
    ? ''
    : Number(value).toLocaleString(undefined, {
        style: 'currency',
        currency: 'ILS',
        maximumFractionDigits: 2,
      });
