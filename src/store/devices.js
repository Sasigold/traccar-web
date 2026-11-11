// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'devices',
  initialState: {
    items: {},
    selectedId: null,
    // Closing the vehicle card hides it but keeps the vehicle selected, so the map keeps
    // following it. Selecting a vehicle (again) shows the card.
    cardHidden: false,
    loaded: false,
    // LIV-25: several vehicles picked in the list for one action; null when not picking.
    picked: null,
  },
  reducers: {
    refresh(state, action) {
      state.items = {};
      action.payload.forEach((item) => (state.items[item.id] = item));
      state.loaded = true;
    },
    update(state, action) {
      action.payload.forEach((item) => (state.items[item.id] = item));
    },
    selectId(state, action) {
      state.selectTime = Date.now();
      state.selectedId = action.payload;
      state.cardHidden = false;
    },
    hideCard(state) {
      state.cardHidden = true;
    },
    startPicking(state) {
      state.picked = [];
    },
    stopPicking(state) {
      state.picked = null;
    },
    togglePicked(state, action) {
      if (!state.picked) return;
      const id = action.payload;
      state.picked = state.picked.includes(id)
        ? state.picked.filter((item) => item !== id)
        : [...state.picked, id];
    },
    setPicked(state, action) {
      state.picked = action.payload;
    },
    // Stop following the selected vehicle (the map is about to show something else, such as
    // where an alert happened); "back to vehicle" brings the lock back.
    releaseFollow(state) {
      state.followReleaseTime = Date.now();
    },
    remove(state, action) {
      delete state.items[action.payload];
    },
  },
});

export { actions as devicesActions };
export { reducer as devicesReducer };
