// Roadmap stage 3: fleet permission keys by area, and the effective role matrix (pure, tested).

export const PERMISSION_AREAS = [
  { area: 'vehicles', keys: ['vehicles.read', 'vehicles.write', 'assignments.write'] },
  { area: 'drivers', keys: ['drivers.read', 'drivers.write'] },
  { area: 'documents', keys: ['documents.read', 'documents.write'] },
  { area: 'alerts', keys: ['alerts.read', 'alerts.manage'] },
  { area: 'maintenance', keys: ['maintenance.read', 'maintenance.write'] },
  { area: 'inspections', keys: ['inspections.read', 'inspections.write', 'inspections.manage'] },
  { area: 'incidents', keys: ['incidents.read', 'incidents.write'] },
  { area: 'costs', keys: ['costs.read', 'costs.write'] },
  { area: 'safety', keys: ['safety.read', 'safety.write'] },
  { area: 'poi', keys: ['poi.read', 'poi.write'] },
  { area: 'dispatch', keys: ['dispatch.read', 'dispatch.write'] },
  { area: 'reports', keys: ['reports.read', 'audit.read'] },
  { area: 'integrations', keys: ['integrations.manage'] },
  { area: 'users', keys: ['users.read', 'users.manage', 'roles.manage'] },
  {
    area: 'billing',
    keys: ['customers.read', 'customers.manage', 'billing.read', 'billing.manage'],
  },
];

// Roles whose permissions an organization may change (owner always has everything).
export const EDITABLE_ROLES = [
  'admin',
  'manager',
  'safety_officer',
  'dispatcher',
  'driver',
  'viewer',
];

// "vehicles.read" -> "fleetPermVehiclesRead"
export const permissionLabelKey = (key) =>
  `fleetPerm${key
    .split('.')
    .map((part) => part.replace(/^\w/, (c) => c.toUpperCase()))
    .join('')}`;

export const areaLabelKey = (area) => `fleetPermArea${area.replace(/^\w/, (c) => c.toUpperCase())}`;

// defaults: [{ role, permission }]; overrides: [{ role, permission, granted }].
export const effectiveGranted = (role, permission, defaults, overrides) => {
  if (role === 'owner') {
    return true;
  }
  const override = overrides.find((row) => row.role === role && row.permission === permission);
  if (override) {
    return override.granted;
  }
  return defaults.some((row) => row.role === role && row.permission === permission);
};

// What to write when a checkbox flips: drop the override when it equals the default.
export const toggleChange = (role, permission, granted, defaults) => {
  const byDefault = defaults.some((row) => row.role === role && row.permission === permission);
  return byDefault === granted ? { remove: true } : { upsert: { role, permission, granted } };
};

// "safety_officer" -> "fleetRoleSafetyOfficer"
export const roleLabelKey = (role) =>
  `fleetRole${role.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())}`;

// Traccar user flags that match a fleet role, so Traccar's own screens agree with it.
export const traccarFlagsForRole = (role) => ({
  readonly: role === 'viewer' || role === 'driver',
  deviceReadonly: ['dispatcher', 'safety_officer', 'viewer', 'driver'].includes(role),
  limitCommands: ['safety_officer', 'viewer', 'driver'].includes(role),
});
