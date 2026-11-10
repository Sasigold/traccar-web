import { getFleetClient } from '../common/fleet/client';
import { alreadySaved, registerOutboxKind, sendFiles } from '../common/fleet/outbox';
import { FILES_BUCKET } from './fleetData';

// ADM-10: the driver's damage report through the outbox. The incident and its third party carry
// ids made in the phone, and each photo a fixed path and id, so any step can be repeated.

const safeName = (name) => name.replace(/[^\w.-]+/g, '_').slice(-80);

// Storage says a path is taken when an earlier try did upload it.
const fileExists = (error) =>
  String(error?.statusCode) === '409' || /exists|duplicate/i.test(error?.message || '');

const insertOnce = async (table, row) => {
  const { error } = await getFleetClient().from(table).insert(row);
  if (error && !alreadySaved(error)) {
    throw error;
  }
};

export const photoPath = (orgId, item, file) =>
  `${orgId}/incidents/${item.id}-${file.id}-${safeName(file.name)}`;

export const sendDamageReport = async (item, mark) => {
  const { incident, party } = item.payload;
  if (!item.saved) {
    await insertOnce('incidents', incident);
    if (party) {
      await insertOnce('incident_parties', party);
    }
    await mark({ saved: true });
  }
  await sendFiles(item, mark, async (file) => {
    const path = photoPath(incident.org_id, item, file);
    const { error } = await getFleetClient()
      .storage.from(FILES_BUCKET)
      .upload(path, file.blob, { contentType: file.type || 'image/jpeg', upsert: false });
    if (error && !fileExists(error)) {
      throw error;
    }
    await insertOnce('incident_photos', {
      id: file.id,
      org_id: incident.org_id,
      incident_id: incident.id,
      storage_path: path,
      file_name: file.label || file.name,
      taken_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    });
  });
};

registerOutboxKind('damage', sendDamageReport);

// ADM-18: the driver's fueling. The receipt goes up first (a fixed path, so a retry finds it),
// then the database books the fueling on the driver's current vehicle, once per id.
export const receiptPath = (orgId, item, file) =>
  `${orgId}/fuel/${item.id}-${file.id}-${safeName(file.name)}`;

export const sendFueling = async (item, mark) => {
  const { fueling } = item.payload;
  let path = null;
  const [file] = item.files;
  if (file) {
    path = receiptPath(fueling.org_id, item, file);
    if (!file.done) {
      const { error } = await getFleetClient()
        .storage.from(FILES_BUCKET)
        .upload(path, file.blob, { contentType: file.type || 'image/jpeg', upsert: false });
      if (error && !fileExists(error)) {
        throw error;
      }
      file.done = true;
      await mark({ files: item.files });
    }
  }
  const { error } = await getFleetClient().rpc('driver_report_fueling', {
    p_id: fueling.id,
    p_occurred_at: fueling.occurred_at,
    p_total: fueling.total,
    p_liters: fueling.liters,
    p_odometer: fueling.odometer,
    p_station: fueling.station,
    p_receipt_path: path,
  });
  if (error) throw error;
  await mark({ saved: true });
};

registerOutboxKind('fuel', sendFueling);
