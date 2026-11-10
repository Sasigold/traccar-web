// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useAsyncTask } from '../reactHelper';
import {
  documentTypesFor,
  driverAttributes,
  driverRow,
  planDocumentSync,
  vehicleAttributes,
  vehicleRow,
} from '../common/fleet/fleetSync';

const isEmpty = (value) => value == null || value === '' || (Array.isArray(value) && !value.length);

const config = {
  vehicle: {
    table: 'vehicles',
    idColumn: 'traccar_device_id',
    fkColumn: 'vehicle_id',
    toRow: vehicleRow,
    toAttributes: vehicleAttributes,
  },
  driver: {
    table: 'drivers',
    idColumn: 'traccar_driver_id',
    fkColumn: 'driver_id',
    toRow: driverRow,
    toAttributes: driverAttributes,
  },
};

// The fleet database row of a Traccar device / driver and its validity documents.
export const loadFleetRecord = async (entity, traccarId) => {
  const { table, idColumn, fkColumn } = config[entity];
  const client = getFleetClient();
  const row = unwrap(await client.from(table).select('*').eq(idColumn, traccarId).maybeSingle());
  if (!row) {
    return { row: null, documents: [] };
  }
  const documents = unwrap(
    await client
      .from('documents')
      .select('id, document_type, expires_at, file_path')
      .eq(fkColumn, row.id)
      .in('document_type', Object.values(documentTypesFor(entity))),
  );
  return { row, documents: documents || [] };
};

// Writes the card (a saved Traccar device / driver) to the fleet database.
// `keepExisting` (bulk copy from the cached Traccar objects) only fills values that are set, so
// nothing already in the database is cleared; a card save sends every field, so clearing works.
// An existing plate number is never replaced by the vehicle name fallback.
// Returns the database row; validity documents follow when `withDocuments` is set.
export const saveFleetRecord = async (
  entity,
  item,
  profile,
  { withDocuments = true, keepExisting = false } = {},
) => {
  const { table, idColumn, fkColumn, toRow } = config[entity];
  const client = getFleetClient();
  const existing = unwrap(
    await client.from(table).select('id').eq(idColumn, item.id).maybeSingle(),
  );
  const payload = toRow(item);
  let row;
  if (existing) {
    const changes = Object.fromEntries(
      Object.entries(payload).filter(([key, value]) => {
        if (key === 'plate_number' && !item.attributes?.plateNumber) {
          return false;
        }
        // Not-null columns are never sent empty.
        if ((key === 'status' || key === 'full_name') && isEmpty(value)) {
          return false;
        }
        return !keepExisting || !isEmpty(value);
      }),
    );
    row = unwrap(
      await client.from(table).update(changes).eq('id', existing.id).select('*').single(),
    );
  } else {
    row = unwrap(
      await client
        .from(table)
        // Unset values are left out so the column defaults (e.g. status) apply.
        .insert({
          ...Object.fromEntries(Object.entries(payload).filter(([, value]) => value != null)),
          org_id: profile.org_id,
        })
        .select('*')
        .single(),
    );
  }
  if (!withDocuments) {
    return row;
  }
  const { documents } = await loadFleetRecord(entity, item.id);
  const plan = planDocumentSync(entity, item.attributes, documents);
  if (plan.insert.length) {
    unwrap(
      await client.from('documents').insert(
        plan.insert.map((document) => ({
          ...document,
          org_id: row.org_id,
          entity,
          [fkColumn]: row.id,
          uploaded_by: profile.id,
        })),
      ),
    );
  }
  for (const { id, expires_at: expiresAt } of plan.update) {
    unwrap(await client.from('documents').update({ expires_at: expiresAt }).eq('id', id));
  }
  return row;
};

// Who may write which entity, and whether the database is connected at all.
export const useFleetAccess = (entity) =>
  useSelector(
    (state) => {
      const { status, permissions, profile } = state.fleet;
      const ready = status === 'ready' && Boolean(profile?.org_id);
      const writeKey = entity === 'vehicle' ? 'vehicles.write' : 'drivers.write';
      return {
        ready,
        read:
          ready && permissions.includes(entity === 'vehicle' ? 'vehicles.read' : 'drivers.read'),
        write: ready && permissions.includes(writeKey),
        documents: ready && permissions.includes('documents.write'),
        profile,
      };
    },
    (a, b) =>
      a.ready === b.ready &&
      a.read === b.read &&
      a.write === b.write &&
      a.documents === b.documents &&
      a.profile === b.profile,
  );

// Once the card is loaded, lays the database values over its attributes (the database wins).
export const useFleetOverlay = (entity, item, setItem) => {
  const access = useFleetAccess(entity);
  const appliedRef = useRef(null);
  const id = item?.id;
  useAsyncTask(async () => {
    if (!access.read || !id || appliedRef.current === id) {
      return;
    }
    appliedRef.current = id;
    const { row, documents } = await loadFleetRecord(entity, id);
    if (row || documents.length) {
      setItem((current) =>
        current && current.id === id
          ? {
              ...current,
              attributes: config[entity].toAttributes(current.attributes || {}, row, documents),
            }
          : current,
      );
    }
  }, [access.read, id, entity, setItem]);
};
