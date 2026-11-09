import { describe, expect, it } from 'vitest';
import { setupProgress, setupSteps } from '../fleetSetup';

describe('fleet setup checklist', () => {
  it('marks each step from the data and points at the first one left', () => {
    const steps = setupSteps({ devices: 3, drivers: 0, assignments: 2, users: 1, recipients: 1 });
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['vehicles', true],
      ['drivers', false],
      ['assignments', true],
      ['users', false], // the owner alone does not count as a team
      ['alerts', true],
      ['inspections', false],
      ['maintenance', false],
    ]);
    const progress = setupProgress(steps);
    expect(progress).toMatchObject({ done: 3, total: 7, complete: false });
    expect(progress.next.id).toBe('drivers');
  });

  it('leaves out what the user may not do', () => {
    const steps = setupSteps({ devices: 1 }, (permission) => permission !== 'users.read');
    expect(steps.some((step) => step.id === 'users')).toBe(false);
  });

  it('is complete when every step is done', () => {
    const counts = {
      devices: 1,
      drivers: 1,
      assignments: 1,
      users: 2,
      recipients: 1,
      templates: 1,
      maintenances: 1,
    };
    expect(setupProgress(setupSteps(counts))).toMatchObject({ complete: true, next: null });
  });
});
