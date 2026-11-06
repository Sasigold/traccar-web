import { useState } from 'react';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useAsyncTask } from '../reactHelper';

// Rows of a fleet database table, reloaded when reloadKey changes; null while loading.
export const useFleetRows = (
  table,
  { select = '*', order, ascending = true, enabled, reloadKey = 0 },
) => {
  const [rows, setRows] = useState(null);
  useAsyncTask(async () => {
    void reloadKey;
    if (!enabled) {
      return;
    }
    let query = getFleetClient().from(table).select(select);
    if (order) {
      query = query.order(order, { ascending });
    }
    setRows(unwrap(await query.limit(1000)) || []);
  }, [table, select, order, ascending, enabled, reloadKey]);
  return rows;
};

// Fleet vehicles (with trailers and equipment) and drivers for pickers.
export const useFleetVehicles = (enabled, reloadKey = 0) =>
  useFleetRows('vehicles', {
    select: '*',
    order: 'plate_number',
    enabled,
    reloadKey,
  });

export const useFleetDrivers = (enabled) =>
  useFleetRows('drivers', {
    select: 'id, full_name, phone, traccar_driver_id',
    order: 'full_name',
    enabled,
  });

// Empty strings become null; numbers stay numbers.
export const cleanPayload = (values, keys) =>
  Object.fromEntries(
    keys.map((key) => {
      const value = values[key];
      if (typeof value === 'string') {
        return [key, value.trim() === '' ? null : value.trim()];
      }
      return [key, value === undefined ? null : value];
    }),
  );

export const toNumber = (value) =>
  value === '' || value === null || value === undefined || Number.isNaN(Number(value))
    ? null
    : Number(value);

export const camel = (value) => value.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
