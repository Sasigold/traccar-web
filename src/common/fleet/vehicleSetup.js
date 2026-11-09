// "New vehicle" wizard (ADM-12): maintenance plans to start from, as Traccar maintenance records.
// Distances are in meters and times in milliseconds, as Traccar stores them. Pure, unit-tested.

const KM = 1000;
const DAY = 24 * 60 * 60 * 1000;

export const MAINTENANCE_TEMPLATES = [
  { id: 'service', type: 'totalDistance', every: 15000, unit: 'km' },
  { id: 'tires', type: 'totalDistance', every: 40000, unit: 'km' },
  { id: 'brakes', type: 'totalDistance', every: 30000, unit: 'km' },
  { id: 'yearly', type: 'fixTime', every: 365, unit: 'days' },
];

// The Traccar maintenance for a template: counted from the odometer today (distance) or from
// today (time), so the first one falls one interval from now.
export const maintenancePayload = (template, name, odometerKm, now = Date.now()) =>
  template.unit === 'km'
    ? {
        name,
        type: template.type,
        start: Math.max(0, Math.round((Number(odometerKm) || 0) * KM)),
        period: template.every * KM,
      }
    : { name, type: template.type, start: now, period: template.every * DAY };

// The record's name says which vehicle it belongs to: in Traccar the start of a maintenance is
// part of the record, not of the link, so every vehicle gets its own.
export const maintenanceName = (templateName, vehicleName) => `${templateName} · ${vehicleName}`;

export const SETUP_STEPS = ['device', 'vehicle', 'validity', 'driver', 'maintenance', 'summary'];
