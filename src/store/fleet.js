import { createSlice } from '@reduxjs/toolkit';

// Connection state of the Viper Fleet database for the logged-in Traccar user.
const { reducer, actions } = createSlice({
  name: 'fleet',
  initialState: {
    status: 'idle', // idle | loading | ready | error | disabled
    profile: null,
    permissions: [],
    error: null,
    alertsCount: 0, // open document alerts (roadmap 3.4), shown on the bell
    privacy: null, // { policy, periods }: working hours and recent private periods (ISR-03)
    // The fleet areas this database has (ADM-08), or null while unknown: unknown shows all.
    features: null,
  },
  reducers: {
    alertsCount(state, action) {
      state.alertsCount = action.payload;
    },
    privacy(state, action) {
      state.privacy = action.payload;
    },
    features(state, action) {
      state.features = action.payload;
    },
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
      state.features = null;
      state.privacy = null;
      state.profile = null;
      state.permissions = [];
      state.error = null;
    },
    reset(state) {
      state.alertsCount = 0;
      state.features = null;
      state.privacy = null;
      state.status = 'idle';
      state.profile = null;
      state.permissions = [];
      state.error = null;
    },
  },
});

export { actions as fleetActions };
export { reducer as fleetReducer };
