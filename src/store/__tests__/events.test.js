import { describe, expect, it } from 'vitest';
import { eventsActions, eventsReducer } from '../events';

const event = (id, minute) => ({
  id,
  eventTime: `2026-11-09T12:${String(minute).padStart(2, '0')}:00Z`,
});
const start = () => eventsReducer(undefined, { type: 'init' });

describe('events store', () => {
  it('does not add an event twice', () => {
    let state = eventsReducer(start(), eventsActions.add([event(1, 1)]));
    state = eventsReducer(state, eventsActions.add([event(1, 1), event(2, 2)]));
    expect(state.items.map((item) => item.id)).toEqual([2, 1]);
  });

  it('puts removed events back in time order (undo)', () => {
    let state = eventsReducer(start(), eventsActions.add([event(1, 1), event(3, 3)]));
    const removed = state.items;
    state = eventsReducer(state, eventsActions.deleteAll());
    state = eventsReducer(state, eventsActions.add([event(2, 2)]));
    state = eventsReducer(state, eventsActions.restore(removed));
    expect(state.items.map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('only moves the last visit forward', () => {
    let state = eventsReducer(start(), eventsActions.markSeen(100));
    state = eventsReducer(state, eventsActions.markSeen(50));
    expect(state.lastSeen).toBe(100);
  });

  it('remembers acknowledged events and the focused one', () => {
    let state = eventsReducer(start(), eventsActions.acknowledge(1));
    state = eventsReducer(state, eventsActions.acknowledge([1, 2]));
    expect(state.acknowledged).toEqual([1, 2]);
    state = eventsReducer(state, eventsActions.focus(event(2, 2)));
    expect(state.focused.id).toBe(2);
    state = eventsReducer(state, eventsActions.focus(null));
    expect(state.focused).toBeNull();
  });
});
