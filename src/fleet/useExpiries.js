import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  collectExpiries,
  countExpiries,
  daysUntilDate,
  driverExpiryFields,
  expiryStatus,
  vehicleExpiryFields,
} from '../common/fleet/fleetFields';
import { mergeDocumentExpiries } from '../common/fleet/fleetSync';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission } from '../common/fleet/useFleet';
import { useAsyncTask } from '../reactHelper';

const labelKeys = Object.fromEntries(
  [...vehicleExpiryFields, ...driverExpiryFields].map((field) => [field.key, field.labelKey]),
);

// Validity dates of every visible vehicle and driver: the cached Traccar objects (stage 0
// attributes) plus, when the fleet database is connected, its documents with an expiry date.
const useExpiries = () => {
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const documentsReadable = useFleetPermission('documents.read');
  const [documents, setDocuments] = useState([]);

  useAsyncTask(async () => {
    if (!documentsReadable) {
      setDocuments([]);
      return;
    }
    const rows = unwrap(await getFleetClient().from('documents_expiring').select('*'));
    setDocuments(rows || []);
  }, [documentsReadable]);

  return useMemo(() => {
    const visibleDevices = new Set(Object.keys(devices).map(Number));
    const visibleDrivers = new Set(
      Object.values(drivers)
        .filter((driver) => driver.attributes?.driverStatus !== 'ended')
        .map((driver) => driver.id),
    );
    const visible = documents.filter((document) =>
      document.entity === 'vehicle'
        ? visibleDevices.has(document.traccar_device_id)
        : visibleDrivers.has(document.traccar_driver_id),
    );
    const rows = mergeDocumentExpiries(
      collectExpiries(Object.values(devices), Object.values(drivers)),
      visible,
      { labelKeys, statusOf: (date) => expiryStatus(date), daysOf: (date) => daysUntilDate(date) },
    );
    return { rows, counts: countExpiries(rows) };
  }, [devices, drivers, documents]);
};

export default useExpiries;
