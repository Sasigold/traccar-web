import { describe, expect, it } from 'vitest';
import {
  commandStatusVisible,
  confirmationMatches,
  confirmationTarget,
  isDangerousCommand,
  COMMAND_STATUS_TTL_MS,
} from '../commands';
import { commandsActions, commandsReducer } from '../../../store/commands';
import { eventsActions } from '../../../store/events';

describe('dangerous commands', () => {
  it('flags engine stop only', () => {
    expect(isDangerousCommand('engineStop')).toBe(true);
    expect(isDangerousCommand('engineResume')).toBe(false);
    expect(isDangerousCommand('positionSingle')).toBe(false);
    expect(isDangerousCommand(undefined)).toBe(false);
  });
});

describe('confirmation', () => {
  it('asks for the plate number, or the name without one', () => {
    expect(
      confirmationTarget({ name: 'Truck', attributes: { plateNumber: ' 12-345-67 ' } }),
    ).toEqual({ kind: 'plate', value: '12-345-67' });
    expect(confirmationTarget({ name: 'משאית 12', attributes: {} })).toEqual({
      kind: 'name',
      value: 'משאית 12',
    });
  });

  it('ignores separators and case', () => {
    expect(confirmationMatches('1234567', '12-345-67')).toBe(true);
    expect(confirmationMatches('12 345 67', '12-345-67')).toBe(true);
    expect(confirmationMatches('ab-12', 'AB12')).toBe(true);
    expect(confirmationMatches('משאית12', 'משאית 12')).toBe(true);
  });

  it('rejects partial or empty input', () => {
    expect(confirmationMatches('123456', '12-345-67')).toBe(false);
    expect(confirmationMatches('', '12-345-67')).toBe(false);
    expect(confirmationMatches('', '')).toBe(false);
    expect(confirmationMatches('--', '--')).toBe(false);
  });
});

describe('status visibility', () => {
  it('hides the status half an hour after the last change', () => {
    const item = { sentAt: 1000, answeredAt: null };
    expect(commandStatusVisible(item, 1000 + COMMAND_STATUS_TTL_MS - 1)).toBe(true);
    expect(commandStatusVisible(item, 1000 + COMMAND_STATUS_TTL_MS)).toBe(false);
    expect(commandStatusVisible({ sentAt: 0, answeredAt: 5000 }, COMMAND_STATUS_TTL_MS + 10)).toBe(
      true,
    );
    expect(commandStatusVisible(undefined, 0)).toBe(false);
  });
});

describe('commands store', () => {
  const sentAt = Date.parse('2026-11-09T12:00:00Z');
  const sent = (queued = false) =>
    commandsReducer(
      undefined,
      commandsActions.sent({ deviceId: 7, type: 'engineStop', queued, sentAt }),
    );

  it('records sent and queued commands', () => {
    expect(sent().items[7].status).toBe('sent');
    expect(sent(true).items[7].status).toBe('queued');
  });

  it('takes the reply from a position with a result', () => {
    const state = commandsReducer(
      sent(),
      commandsActions.results([
        { deviceId: 7, serverTime: '2026-11-09T12:00:04Z', attributes: { result: 'STOP OK' } },
      ]),
    );
    expect(state.items[7]).toMatchObject({ status: 'answered', result: 'STOP OK' });
    expect(state.items[7].answeredAt).toBe(Date.parse('2026-11-09T12:00:04Z'));
  });

  it('ignores results from before the command and from other devices', () => {
    const state = commandsReducer(
      sent(),
      commandsActions.results([
        { deviceId: 7, serverTime: '2026-11-09T11:59:00Z', attributes: { result: 'old' } },
        { deviceId: 8, serverTime: '2026-11-09T12:00:04Z', attributes: { result: 'other' } },
        { deviceId: 7, serverTime: '2026-11-09T12:00:05Z', attributes: {} },
      ]),
    );
    expect(state.items[7].status).toBe('sent');
    expect(state.items[8]).toBeUndefined();
  });

  it('follows queued commands through events', () => {
    let state = commandsReducer(
      sent(true),
      eventsActions.add([
        { id: 1, deviceId: 7, type: 'queuedCommandSent', eventTime: '2026-11-09T12:10:00Z' },
      ]),
    );
    expect(state.items[7].status).toBe('delivered');
    state = commandsReducer(
      state,
      eventsActions.add([
        {
          id: 2,
          deviceId: 7,
          type: 'commandResult',
          eventTime: '2026-11-09T12:10:03Z',
          attributes: { result: 'done' },
        },
      ]),
    );
    expect(state.items[7]).toMatchObject({ status: 'answered', result: 'done' });
  });

  it('clears a device', () => {
    expect(commandsReducer(sent(), commandsActions.clear(7)).items[7]).toBeUndefined();
  });
});
