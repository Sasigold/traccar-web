import { describe, expect, it } from 'vitest';
import { planAllows, requiredPlan } from '../plans';

// BIZ-02: plans open areas; a trial opens the next plan; an unknown plan closes nothing.
describe('plans', () => {
  it('open each area from its plan up', () => {
    expect(requiredPlan('costs.read')).toBe('fleet');
    expect(requiredPlan('integrations.manage')).toBe('pro');
    expect(requiredPlan('vehicles.read')).toBeNull();
    expect(planAllows({ plan: 'tracking' }, 'costs.read')).toBe(false);
    expect(planAllows({ plan: 'fleet' }, 'costs.read')).toBe(true);
    expect(planAllows({ plan: 'fleet' }, 'integrations.manage')).toBe(false);
    expect(planAllows({ plan: 'pro' }, 'integrations.manage')).toBe(true);
    expect(planAllows({ plan: 'tracking' }, 'vehicles.read')).toBe(true);
  });

  it('a trial opens the next plan while it lasts', () => {
    expect(planAllows({ plan: 'tracking', trial: 'fleet' }, 'safety.read')).toBe(true);
    expect(planAllows({ plan: 'tracking', trial: 'fleet' }, 'integrations.manage')).toBe(false);
  });

  it('an unknown plan closes nothing', () => {
    expect(planAllows(null, 'integrations.manage')).toBe(true);
  });
});
