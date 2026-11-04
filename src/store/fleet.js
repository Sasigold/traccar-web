import { createSlice } from '@reduxjs/toolkit';

// Connection state of the Viper Fleet database for the logged-in Traccar user.
const { reducer, actions } = createSlice({
  name: 'fleet',
  initialState: {
    status: 'idle', // idle | loading | ready | error | disabled
    profile: null,
    permissions: [],
    error: null,
  },
  reducers: {
    loading(state) {
      state.status = 'loading';
      state.error = null;
    },
    ready(state, action) {
      state.status = 'ready';
      state.profile = action.payload.profile;
      state.permissions = action.payload.permissions || [];
      state.error = null;
    },
    failed(state, action) {
      state.status = 'error';
      state.error = action.payload;
    },
    disabled(state) {
      state.status = 'disabled';
      state.profile = null;
      state.permissions = [];
      state.error = null;
    },
    reset(state) {
      state.status = 'idle';
      state.profile = null;
      state.permissions = [];
      state.error = null;
    },
  },
});

export { actions as fleetActions };
export { reducer as fleetReducer };
