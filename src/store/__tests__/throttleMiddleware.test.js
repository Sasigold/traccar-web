import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import throttleMiddleware from '../throttleMiddleware';
import { sessionActions } from '../session';

const positions = (...items) =>
  sessionActions.updatePositions(items.map(([deviceId, speed]) => ({ deviceId, speed })));

describe('throttleMiddleware', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (selectedId) => {
    const next = vi.fn();
    const store = { getState: () => ({ devices: { selectedId } }) };
    const dispatch = throttleMiddleware(store)(next);
    return { next, dispatch };
  };

  // Enough updates in one interval to switch throttling on.
  const flood = (dispatch) => {
    for (let i = 0; i < 6; i += 1) {
      dispatch(positions([9, i]));
    }
  };

  it('passes the selected device through while the rest is buffered', () => {
    const { next, dispatch } = setup(1);
    flood(dispatch);
    next.mockClear();

    dispatch(positions([1, 50], [2, 30]));
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].payload).toEqual([{ deviceId: 1, speed: 50 }]);

    vi.advanceTimersByTime(1500);
    const flushed = next.mock.calls.slice(1).flatMap(([action]) => action.payload);
    expect(flushed).toContainEqual({ deviceId: 2, speed: 30 });
    expect(flushed.some((item) => item.deviceId === 1)).toBe(false);
  });

  it('drops buffered updates older than a live one for the selected device', () => {
    let selectedId = null;
    const next = vi.fn();
    const dispatch = throttleMiddleware({ getState: () => ({ devices: { selectedId } }) })(next);
    flood(dispatch);
    dispatch(positions([1, 10]));
    selectedId = 1;
    dispatch(positions([1, 60]));
    next.mockClear();

    vi.advanceTimersByTime(1500);
    const flushed = next.mock.calls.flatMap(([action]) => action.payload);
    expect(flushed.some((item) => item.deviceId === 1)).toBe(false);
  });
});
