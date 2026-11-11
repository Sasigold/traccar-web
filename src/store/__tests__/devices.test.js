import { describe, expect, it } from 'vitest';
import { devicesActions, devicesReducer } from '../devices';

const run = (actions) =>
  actions.reduce(devicesReducer, devicesReducer(undefined, { type: 'init' }));

describe('picking several vehicles (LIV-25)', () => {
  it('is off until started, and starts empty', () => {
    expect(run([]).picked).toBeNull();
    expect(run([devicesActions.startPicking()]).picked).toEqual([]);
  });

  it('toggles a vehicle in and out', () => {
    const state = run([
      devicesActions.startPicking(),
      devicesActions.togglePicked(1),
      devicesActions.togglePicked(2),
      devicesActions.togglePicked(1),
    ]);
    expect(state.picked).toEqual([2]);
  });

  it('picks all shown at once, and stopping clears the pick', () => {
    let state = run([devicesActions.startPicking(), devicesActions.setPicked([3, 4, 5])]);
    expect(state.picked).toEqual([3, 4, 5]);
    state = devicesReducer(state, devicesActions.stopPicking());
    expect(state.picked).toBeNull();
  });
});
