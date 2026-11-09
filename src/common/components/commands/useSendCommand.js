import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { commandsActions, messagesActions } from '../../../store';
import { useTranslation } from '../LocalizationProvider';
import fetchOrThrow from '../../util/fetchOrThrow';

// Sends a command and records it, so the vehicle card can follow it until the device replies.
// Resolves to true when Traccar queued it (the device is offline).
export default () => {
  const dispatch = useDispatch();
  const t = useTranslation();

  return useCallback(
    async (deviceId, command) => {
      const response = await fetchOrThrow('api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, deviceId }),
      });
      const queued = response.status === 202;
      const serverTime = Date.parse(response.headers.get('Date'));
      dispatch(
        commandsActions.sent({
          deviceId,
          type: command.type,
          description: command.description,
          queued,
          sentAt: Number.isNaN(serverTime) ? Date.now() : serverTime,
        }),
      );
      dispatch(
        messagesActions.push({
          message: t(queued ? 'commandQueued' : 'commandSent'),
          severity: 'success',
        }),
      );
      return queued;
    },
    [dispatch, t],
  );
};
