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
