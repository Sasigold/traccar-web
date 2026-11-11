// ADM-31: the vehicles that drove today and have no morning check. Pure, unit-tested.

/**
 * @param {{ id: string, plate_number?: string, traccar_device_id?: number | null }[]} vehicles
 * @param {{ deviceId: number, distance?: number }[]} summary today's Traccar summary
 * @param {{ vehicle_id: string }[]} inspections today's checks
 */
export const missedChecks = (vehicles, summary, inspections) => {
  const driven = new Set(
    (summary || []).filter((row) => row.distance > 0).map((row) => row.deviceId),
  );
  const checked = new Set((inspections || []).map((row) => row.vehicle_id));
  return (vehicles || []).filter(
    (vehicle) =>
      vehicle.traccar_device_id != null &&
      driven.has(vehicle.traccar_device_id) &&
      !checked.has(vehicle.id),
  );
};

// A daily check is asked for when the organization has an active daily checklist.
/** @param {{ frequency?: string, active?: boolean }[]} templates */
export const dailyCheckRequired = (templates) =>
  (templates || []).some((template) => template.active !== false && template.frequency === 'daily');
