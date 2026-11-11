// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// "Set up your fleet" (ADM-01): the steps a new customer goes through, in order, each done when
// the data says so. Steps the user may not do are left out. Pure, unit-tested.

export const SETUP_STEPS = [
  { id: 'vehicles', count: 'devices', path: '/fleet/vehicle/new' },
  { id: 'drivers', count: 'drivers', path: '/settings/driver' },
  {
    id: 'assignments',
    count: 'assignments',
    path: '/fleet/drivers',
    permission: 'vehicles.read',
  },
  { id: 'users', count: 'users', path: '/fleet/users', permission: 'users.read', min: 2 },
  { id: 'alerts', count: 'recipients', path: '/fleet/alerts', permission: 'alerts.manage' },
  {
    id: 'inspections',
    count: 'templates',
    path: '/fleet/inspections',
    permission: 'inspections.write',
  },
  { id: 'maintenance', count: 'maintenances', path: '/settings/maintenances' },
];

// counts: { devices, drivers, ... } (undefined while loading); can: (permission) => boolean.
export const setupSteps = (counts, can = () => true) =>
  SETUP_STEPS.filter((step) => !step.permission || can(step.permission)).map((step) => ({
    id: step.id,
    path: step.path,
    known: counts[step.count] != null,
    done: (counts[step.count] || 0) >= (step.min || 1),
  }));

export const setupProgress = (steps) => {
  const done = steps.filter((step) => step.done).length;
  return {
    done,
    total: steps.length,
    complete: steps.length > 0 && done === steps.length,
    next: steps.find((step) => !step.done) || null,
  };
};
