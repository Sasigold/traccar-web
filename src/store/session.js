import { createSlice } from '@reduxjs/toolkit';

export const MAX_LOGS = 1000;

const { reducer, actions } = createSlice({
  name: 'session',
  initialState: {
    server: null,
    user: null,
    socket: null,
    // Time of the last socket message (ms), and of the next reconnect attempt while disconnected.
    lastMessageAt: null,
    reconnectAt: null,
    includeLogs: false,
    logs: [],
    positions: {},
    history: {},
  },
  reducers: {
    updateServer(state, action) {
      state.server = action.payload;
    },
    updateUser(state, action) {
      state.user = action.payload;
    },
    updateSocket(state, action) {
      state.socket = action.payload;
      if (action.payload) {
        state.reconnectAt = null;
      }
    },
    updateLastMessage(state, action) {
      state.lastMessageAt = action.payload;
    },
    updateReconnectAt(state, action) {
      state.reconnectAt = action.payload;
    },
    enableLogs(state, action) {
      state.includeLogs = action.payload;
      if (!action.payload) {
        state.logs = [];
      }
    },
    // ARC-14: the logs page shows the latest; the store keeps at most MAX_LOGS.
    updateLogs(state, action) {
      state.logs.push(...action.payload);
      if (state.logs.length > MAX_LOGS) {
        state.logs.splice(0, state.logs.length - MAX_LOGS);
      }
    },
    updatePositions(state, action) {
      // Positions can still arrive (socket, throttle flush) right after logout.
      if (!state.user) {
        return;
      }
      const userAttributes = state.user.attributes || {};
      const serverAttributes = state.server?.attributes || {};
      const liveRoutes = userAttributes.mapLiveRoutes || serverAttributes.mapLiveRoutes || 'none';
      const liveRoutesLimit =
        userAttributes['web.liveRouteLength'] || serverAttributes['web.liveRouteLength'] || 10;
      action.payload.forEach((position) => {
        state.positions[position.deviceId] = position;
        if (liveRoutes !== 'none') {
          const route = state.history[position.deviceId] || [];
          const last = route.at(-1);
          if (!last || last[0] !== position.longitude || last[1] !== position.latitude) {
            state.history[position.deviceId] = [
              ...route.slice(1 - liveRoutesLimit),
              [position.longitude, position.latitude],
            ];
          }
        } else {
          state.history = {};
        }
      });
    },
  },
});

export { actions as sessionActions };
export { reducer as sessionReducer };
