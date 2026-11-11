import { createSlice } from '@reduxjs/toolkit';

// ARC-14: the same message twice in a row is shown once, and at most MAX_MESSAGES wait (the
// oldest non-error ones go first), so a failure that repeats every few minutes does not pile
// up behind the snackbar.
export const MAX_MESSAGES = 5;

const textOf = (message) => (typeof message === 'string' ? message : message?.message);
const severityOf = (message) => (typeof message === 'string' ? null : message?.severity) || 'error';

const { reducer, actions } = createSlice({
  name: 'messages',
  initialState: {
    messages: [],
  },
  reducers: {
    push(state, action) {
      const text = textOf(action.payload);
      if (state.messages.some((message) => textOf(message) === text)) {
        return;
      }
      state.messages.push(action.payload);
      while (state.messages.length > MAX_MESSAGES) {
        // Keep the one on screen; drop the oldest waiting message that is not an error, else
        // the oldest waiting one.
        const index = state.messages.findIndex(
          (message, i) => i > 0 && severityOf(message) !== 'error',
        );
        state.messages.splice(index > 0 ? index : 1, 1);
      }
    },
    pop(state) {
      if (state.messages.length) {
        state.messages.shift();
      }
    },
  },
});

export { actions as messagesActions };
export { reducer as messagesReducer };
