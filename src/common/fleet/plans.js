import { useFleetQuery } from '../data/fleetQuery';
import { useFleetReady } from './useFleet';

// BIZ-02: what each plan includes. Areas are named by the permission their pages ask for.
export const PLANS = ['tracking', 'fleet', 'pro'];

const AREA_PLAN = {
  // fleet management
  'documents.read': 'fleet',
  'maintenance.read': 'fleet',
  'costs.read': 'fleet',
  'safety.read': 'fleet',
  'inspections.read': 'fleet',
  'incidents.read': 'fleet',
  'dispatch.read': 'fleet',
  'poi.read': 'fleet',
  // professional
  'integrations.manage': 'pro',
  'ai.use': 'pro',
};

const rank = (plan) => Math.max(0, PLANS.indexOf(plan));

// The plan an area needs, or null when every plan has it.
export const requiredPlan = (permission) => AREA_PLAN[permission] || null;

// Whether the organization's plan (or a running trial) includes the area. Unknown plan: yes,
// so nothing closes by accident.
export const planAllows = (current, permission) => {
  const needed = requiredPlan(permission);
  if (!needed || !current?.plan) return true;
  const best = Math.max(rank(current.plan), current.trial ? rank(current.trial) : 0);
  return best >= rank(needed);
};

export const useOrgPlan = () => {
  const ready = useFleetReady();
  const { data } = useFleetQuery('organizations', ['plan'], (client) => client.rpc('org_plan'), {
    enabled: ready,
  });
  return data || null;
};
