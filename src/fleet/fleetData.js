import { useMemo } from 'react';
import { shrinkImage } from '../common/fleet/outbox';
import { useFleetQuery } from '../common/data/fleetQuery';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { saveFleetRecord } from './fleetRecords';
import { getFormatLocale } from '../common/util/formatter';

export const FILES_BUCKET = 'fleet-files';

const safeName = (name) => name.replace(/[^\w.-]+/g, '_').slice(-80);

// <org>/<area>/<uuid>-<name>; the area (work-orders, incidents, inspections, expenses) picks
// the storage permission, see fleet_file_permission() in the stage 2 migration.
// SEC-17: photos are drawn again before upload (smaller, and without their GPS position).
export const uploadFleetFile = async (orgId, area, original) => {
  const file = await shrinkImage(original, 2400);
  const path = `${orgId}/${area}/${crypto.randomUUID()}-${safeName(file.name)}`;
  unwrap(
    await getFleetClient()
      .storage.from(FILES_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }),
  );
  return path;
};

// Images open in the browser; anything else is downloaded, so a file can never run as a page
// (SEC-17).
export const isImagePath = (path) => /\.(jpe?g|png|webp|gif|heic)$/i.test(path || '');

export const openFleetFile = async (path) => {
  const { signedUrl } = unwrap(
    await getFleetClient()
      .storage.from(FILES_BUCKET)
      .createSignedUrl(path, 120, isImagePath(path) ? undefined : { download: true }),
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
const EMPTY = {};
export const useVehicleIndex = (enabled) => {
  const { data } = useFleetQuery(
    'vehicles',
    ['index'],
    (client) => client.from('vehicles').select('id, traccar_device_id, plate_number'),
    { enabled },
  );
  return useMemo(
    () =>
      data
        ? Object.fromEntries(
            data.map((row) => [
              row.id,
              { traccarId: row.traccar_device_id, plate: row.plate_number },
            ]),
          )
        : EMPTY,
    [data],
  );
};

const NONE = [];
export const useVendors = (enabled, reloadKey = 0) => {
  const { data } = useFleetQuery(
    'vendors',
    ['all'],
    (client) => client.from('vendors').select('*').order('name'),
    { enabled, reloadKey },
  );
  return (enabled && data) || NONE;
};

export const money = (value) =>
  value == null || value === ''
    ? ''
    : Number(value).toLocaleString(getFormatLocale(), {
        style: 'currency',
        currency: 'ILS',
        maximumFractionDigits: 2,
      });
