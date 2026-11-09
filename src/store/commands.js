import { createSlice } from '@reduxjs/toolkit';
import { eventsActions } from './events';

// The last command sent to each device and what came of it, so the vehicle card can show
// "נשלחה 14:32 · בתור · התקבלה תשובה" after its dialog has closed.
//
// status: 'sent' (the device was online and took it), 'queued' (offline, Traccar holds it),
// 'delivered' (a queued command went out when the device connected) and 'answered' (the device
// replied: a position with a `result` attribute, or a commandResult event).
//
// Times are in the server's clock (the Date header of the send response), so a reply is matched
// to the command even when the browser's clock is off.

// The Date header has whole seconds; a reply in the same second must still count.
const SKEW_MS = 2000;

const at = (value) => (value ? Date.parse(value) : NaN);

const answer = (state, deviceId, result, time) => {
  const item = state.items[deviceId];
  if (!item || !(time >= item.sentAt - SKEW_MS)) {
    return;
  }
  item.status = 'answered';
  item.result = result == null ? null : String(result);
  item.answeredAt = time;
};

const { reducer, actions } = createSlice({
  name: 'commands',
  initialState: {
    items: {},
  },
  reducers: {
    sent(state, action) {
      const { deviceId, type, description, queued, sentAt } = action.payload;
      state.items[deviceId] = {
        type: type || null,
        description: description || null,
        status: queued ? 'queued' : 'sent',
        sentAt,
        result: null,
        answeredAt: null,
      };
    },
    // Positions straight from the socket (ahead of the throttle, which keeps only the latest
    // position of each device and could drop the reply).
    results(state, action) {
      action.payload.forEach((position) => {
        const result = position.attributes?.result;
        if (result != null) {
          answer(state, position.deviceId, result, at(position.serverTime || position.fixTime));
        }
      });
    },
    clear(state, action) {
      delete state.items[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(eventsActions.add, (state, action) => {
      action.payload.forEach((event) => {
        const item = state.items[event.deviceId];
        if (!item) {
          return;
        }
        const time = at(event.eventTime);
        if (event.type === 'commandResult') {
          answer(state, event.deviceId, event.attributes?.result, time);
        } else if (
          event.type === 'queuedCommandSent' &&
          item.status === 'queued' &&
          time >= item.sentAt - SKEW_MS
        ) {
          item.status = 'delivered';
        }
      });
    });
  },
});

export { actions as commandsActions };
export { reducer as commandsReducer };
