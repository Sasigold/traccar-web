import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'events',
  initialState: {
    items: [],
  },
  reducers: {
    // Newest first; an event that is already listed (live and back-filled) is not added twice.
    add(state, action) {
      const known = new Set(state.items.map((item) => item.id));
      const fresh = action.payload.filter((item) => item.id == null || !known.has(item.id));
      state.items.unshift(...fresh);
      state.items.splice(50);
    },
    delete(state, action) {
      state.items = state.items.filter((item) => item.id !== action.payload.id);
    },
    deleteAll(state) {
      state.items = [];
    },
  },
});

export { actions as eventsActions };
export { reducer as eventsReducer };
