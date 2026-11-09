import { createSlice } from '@reduxjs/toolkit';

const SEEN_KEY = 'eventsSeenAt';
const LIMIT = 50;

const readLastSeen = () => {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const storeLastSeen = (time) => {
  try {
    window.localStorage.setItem(SEEN_KEY, String(time));
  } catch {
    // Unread counts fall back to this session only.
  }
};

const byTimeDesc = (a, b) => (Date.parse(b.eventTime) || 0) - (Date.parse(a.eventTime) || 0);

const { reducer, actions } = createSlice({
  name: 'events',
  initialState: () => ({
    items: [],
    // Events after this time (ms) are unread; set when the alerts list is opened.
    lastSeen: typeof window === 'undefined' ? 0 : readLastSeen(),
    // Critical events someone has acknowledged (their banner is gone).
    acknowledged: [],
    // The event opened from the alerts list, shown on the vehicle card and the map.
    focused: null,
    locateTime: null,
  }),
  reducers: {
    // Newest first; an event that is already listed (live and back-filled) is not added twice.
    add(state, action) {
      const known = new Set(state.items.map((item) => item.id));
      const fresh = action.payload.filter((item) => item.id == null || !known.has(item.id));
      state.items.unshift(...fresh);
      state.items.splice(LIMIT);
    },
    delete(state, action) {
      state.items = state.items.filter((item) => item.id !== action.payload.id);
    },
    deleteAll(state) {
      state.items = [];
    },
    // Undo of a removal: the events go back in time order.
    restore(state, action) {
      const known = new Set(state.items.map((item) => item.id));
      const back = action.payload.filter((item) => item.id == null || !known.has(item.id));
      state.items = [...state.items, ...back].sort(byTimeDesc).slice(0, LIMIT);
    },
    markSeen(state, action) {
      state.lastSeen = Math.max(state.lastSeen, action.payload);
    },
    acknowledge(state, action) {
      const ids = Array.isArray(action.payload) ? action.payload : [action.payload];
      const acknowledged = new Set(state.acknowledged);
      ids.forEach((id) => acknowledged.add(id));
      state.acknowledged = [...acknowledged].slice(-200);
    },
    focus(state, action) {
      state.focused = action.payload || null;
      state.locateTime = null;
    },
    // Fly the map to where the focused event happened.
    locate(state) {
      state.locateTime = Date.now();
    },
  },
});

export { actions as eventsActions };
export { reducer as eventsReducer };
