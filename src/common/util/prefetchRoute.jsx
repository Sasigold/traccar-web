// A .jsx file on purpose: it imports the pages, and the type check (ARC-11) covers .js only.
// LIV-16: a screen's code starts loading when the pointer rests on (or the keyboard reaches) its
// item in the navigation, so the click opens it without waiting. The same modules as the routes
// in Navigation.jsx, so the browser reuses the chunk; each is asked for once.

const LOADERS = [
  ['/today', () => import('../../main/TodayPage')],
  ['/dashboard', () => import('../../dashboard/DashboardPage')],
  ['/reports', () => import('../../reports/ReportsHubPage')],
  ['/geofences', () => import('../../other/GeofencesPage')],
  ['/fleet', () => import('../../fleet/FleetHubPage')],
  ['/driver', () => import('../../fleet/DriverPortalPage')],
  ['/settings', () => import('../../settings/SettingsHubPage')],
  ['/admin', () => import('../../admin/AdminOverviewPage')],
];

const started = new Set();

export const loaderFor = (path) =>
  LOADERS.find(([prefix]) => path === prefix || path?.startsWith(`${prefix}/`))?.[1] ?? null;

export const prefetchRoute = (path) => {
  const load = loaderFor(path);
  if (!load || started.has(load)) return false;
  started.add(load);
  // A failed prefetch is not an error: the click loads it again.
  load().catch(() => started.delete(load));
  return true;
};
