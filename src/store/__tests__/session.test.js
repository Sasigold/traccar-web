import { describe, expect, it } from 'vitest';
import { sessionActions, sessionReducer } from '../session';

describe('session reducer', () => {
  it('ignores positions that arrive after logout', () => {
    const state = sessionReducer(undefined, sessionActions.updateUser(null));
    const next = sessionReducer(state, sessionActions.updatePositions([{ deviceId: 1 }]));
    expect(next.positions).toEqual({});
  });

  it('stores positions without server attributes', () => {
    let state = sessionReducer(undefined, sessionActions.updateUser({ id: 1, attributes: {} }));
    state = sessionReducer(state, sessionActions.updatePositions([{ deviceId: 7, latitude: 1 }]));
    expect(state.positions[7]).toEqual({ deviceId: 7, latitude: 1 });
  });
});
