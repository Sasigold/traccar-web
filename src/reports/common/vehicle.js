import { formatPlate } from '../../common/util/israeliFields';

// REP-12: how a report names a vehicle: its name, its plate under it, and "#id" for a vehicle
// that was deleted since (instead of breaking the report).
export const plateOf = (device) => {
  const plate = device?.attributes?.plateNumber || device?.attributes?.plate;
  return plate ? formatPlate(String(plate)) : '';
};

export const vehicleName = (devices, id) => devices?.[id]?.name || `#${id}`;

// For sheet titles and single-line places.
export const vehicleTitle = (devices, id) =>
  [vehicleName(devices, id), plateOf(devices?.[id])].filter(Boolean).join(' · ');
