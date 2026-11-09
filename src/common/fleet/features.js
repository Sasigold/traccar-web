import { useSelector } from 'react-redux';
import { getFleetClient } from './client';

// ADM-08: which fleet areas this database has. fleet_features() answers in one call; on a
// database without it (older than the app), each area's table is probed once. A screen whose
// tables are missing is hidden instead of showing a raw database error.
export const FEATURE_TABLES = {
  dispatch: 'dispatch_jobs',
  workOrders: 'work_orders',
  inspections: 'inspections',
  incidents: 'incidents',
  costs: 'vehicle_expenses',
  safety: 'driver_violations',
  safetyOfficer: 'safety_procedures',
  poi: 'pois',
  alerts: 'document_alerts',
  integrations: 'api_keys',
  privacy: 'privacy_policies',
};

// PostgREST: a missing function is PGRST202, a missing table PGRST205 or 42P01.
const missing = (error) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code);

export const loadFleetFeatures = async (client = getFleetClient()) => {
  const { data, error } = await client.rpc('fleet_features');
  if (!error) {
    // An empty or odd answer is "unknown": a fleet database always has some of these areas.
    return Array.isArray(data) && data.length ? data : null;
  }
  if (!missing(error)) {
    return null;
  }
  const probes = await Promise.all(
    Object.entries(FEATURE_TABLES).map(async ([feature, table]) => {
      const result = await client.from(table).select('id', { head: true }).limit(1);
      return missing(result.error) ? null : feature;
    }),
  );
  return probes.filter(Boolean);
};

// True while unknown (no answer yet, or an error other than "missing"), so nothing disappears by
// accident.
export const hasFleetFeature = (features, feature) => !features || features.includes(feature);

export const useFleetFeature = (feature) =>
  useSelector((state) => hasFleetFeature(state.fleet.features, feature));

export const useFleetFeatures = () => useSelector((state) => state.fleet.features);
