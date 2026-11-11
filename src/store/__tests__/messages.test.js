import { describe, expect, it } from 'vitest';
import { MAX_MESSAGES, messagesActions, messagesReducer } from '../messages';
import { MAX_LOGS, sessionActions, sessionReducer } from '../session';

const run = (actions) => actions.reduce(messagesReducer, undefined);

describe('the message queue (ARC-14)', () => {
  it('shows the same message once while it waits', () => {
    const state = run([
      messagesActions.push('Network error'),
      messagesActions.push('Network error'),
      messagesActions.push({ message: 'Network error', severity: 'error' }),
    ]);
    expect(state.messages).toHaveLength(1);
  });

  it('keeps at most a few, dropping the oldest waiting non-errors first', () => {
    const state = run([
      messagesActions.push({ message: 'on screen', severity: 'error' }),
      messagesActions.push({ message: 'saved 1', severity: 'success' }),
      ...Array.from({ length: 6 }, (_, i) => messagesActions.push(`error ${i}`)),
    ]);
    expect(state.messages).toHaveLength(MAX_MESSAGES);
    expect(state.messages[0]).toEqual({ message: 'on screen', severity: 'error' });
    expect(state.messages.map((m) => m.message || m)).not.toContain('saved 1');
  });
});

describe('the logs (ARC-14)', () => {
  it('keep the latest only', () => {
    let state = sessionReducer(undefined, { type: 'init' });
    const batch = Array.from({ length: 700 }, (_, i) => ({ id: i }));
    state = sessionReducer(state, sessionActions.updateLogs(batch));
    state = sessionReducer(
      state,
      sessionActions.updateLogs(batch.map((log) => ({ id: log.id + 700 }))),
    );
    expect(state.logs).toHaveLength(MAX_LOGS);
    expect(state.logs.at(-1)).toEqual({ id: 1399 });
  });
});
