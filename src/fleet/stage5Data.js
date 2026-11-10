import { useFleetQuery } from '../common/data/fleetQuery';

// Rows of a fleet database table through the shared cache (ARC-06): two screens asking for the
// same rows share one request. Reloaded when reloadKey changes; null while loading.
export const useFleetRows = (
  table,
  { select = '*', order, ascending = true, enabled, reloadKey = 0 },
) => {
  const { data } = useFleetQuery(
    table,
    [select, order ?? null, ascending],
    (client) => {
      let query = client.from(table).select(select);
      if (order) {
        query = query.order(order, { ascending });
      }
      return query;
    },
    { enabled, reloadKey, paged: true },
  );
  return enabled && data ? data : null;
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
