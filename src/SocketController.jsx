import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { commandsActions, devicesActions, messagesActions, sessionActions } from './store';
import { useCatchCallback, useAsyncTask } from './reactHelper';
import { snackBarDurationLongMs } from './common/util/duration';
import { playAlarm } from './common/util/alarmSound';
import { eventSeverity } from './common/util/eventSeverity';
import { formatNotificationTitle } from './common/util/formatter';
import { useTranslation } from './common/components/LocalizationProvider';
import { eventsActions } from './store/events';
import useFeatures from './common/util/useFeatures';
import { useAttributePreference } from './common/util/preferences';
import {
  handleNativeNotificationListeners,
  nativePostMessage,
} from './common/components/NativeInterface';
import fetchOrThrow from './common/util/fetchOrThrow';
import { backfillRange, reconnectDelay } from './common/util/reconnect';
import { chunk } from './dashboard/data/reportFetch';
import { RECONNECT_NOW_EVENT } from './common/components/shell/SocketStatusPill';
import { countEvent } from './common/telemetry/metrics';

const logoutCode = 4000;
// The last-message time is stored at most this often (the pill shows minutes).
const ACTIVITY_STEP_MS = 5000;

const SocketController = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();

  const authenticated = useSelector((state) => Boolean(state.session.user));
  const includeLogs = useSelector((state) => state.session.includeLogs);

  const socketRef = useRef();
  const reconnectTimeoutRef = useRef();
  const attemptRef = useRef(0);
  const lastMessageRef = useRef(null);
  const lastStoredRef = useRef(0);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const soundEvents = useAttributePreference('soundEvents', '');
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');

  const features = useFeatures();

  const t = useTranslation();

  // Critical events sound (their banner is AlertBanner); warnings show a notice for a few
  // seconds; the rest only raise the bell count. Events missed while offline (back-filled) still
  // sound when critical, but bring no notices.
  const handleEvents = useCallback(
    (events, { backfill = false } = {}) => {
      if (!features.disableEvents) {
        dispatch(eventsActions.add(events));
      }
      const preferences = { soundAlarms, soundEvents };
      if (events.some((event) => eventSeverity(event, preferences) === 'critical')) {
        playAlarm();
      }
      const warnings = backfill
        ? []
        : events.filter((event) => eventSeverity(event, preferences) === 'warning');
      if (warnings.length && !features.disableEvents) {
        const [latest] = warnings;
        const devices = store.getState().devices.items;
        const title = formatNotificationTitle(t, {
          type: latest.type,
          attributes: { alarms: latest.attributes?.alarm },
        });
        const name = devices[latest.deviceId]?.name;
        dispatch(
          messagesActions.push({
            message: [title, name, warnings.length > 1 ? `+${warnings.length - 1}` : null]
              .filter(Boolean)
              .join(' · '),
            severity: 'warning',
            duration: 6000,
          }),
        );
      }
      events.forEach((event) => {
        if (event.attributes.message) {
          dispatch(
            messagesActions.push({
              message: event.attributes.message,
              severity: 'info',
              duration: snackBarDurationLongMs,
            }),
          );
        }
      });
    },
    [features, dispatch, soundEvents, soundAlarms, store, t],
  );

  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;

  const includeLogsRef = useRef(includeLogs);
  includeLogsRef.current = includeLogs;

  const connectSocketRef = useRef();

  const markActivity = useCallback(() => {
    const now = Date.now();
    lastMessageRef.current = now;
    if (now - lastStoredRef.current >= ACTIVITY_STEP_MS) {
      lastStoredRef.current = now;
      dispatch(sessionActions.updateLastMessage(now));
    }
  }, [dispatch]);

  // Events (alarms included) raised while the socket was down are not replayed by Traccar; fetch
  // them from the events report once the connection is back.
  const backfillEvents = useCallback(
    async (since) => {
      const range = backfillRange(since);
      const deviceIds = Object.keys(store.getState().devices.items);
      if (!range || !deviceIds.length) {
        return;
      }
      try {
        const events = [];
        for (const ids of chunk(deviceIds.slice(0, 1000))) {
          const query = new URLSearchParams({ ...range });
          ids.forEach((id) => query.append('deviceId', id));
          query.append('type', 'allEvents');
          const response = await fetch(`api/reports/events?${query.toString()}`, {
            headers: { Accept: 'application/json' },
          });
          if (response.ok) {
            events.push(...(await response.json()));
          }
        }
        if (events.length) {
          events.sort((a, b) => Date.parse(b.eventTime) - Date.parse(a.eventTime));
          handleEventsRef.current(events.slice(0, 50), { backfill: true });
        }
      } catch {
        // best effort: the live feed continues either way
      }
    },
    [store],
  );

  const connectSocket = useCallback(() => {
    clearReconnectTimeout();
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
    }
    const url = new URL('api/socket', document.baseURI);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      const missedSince = attemptRef.current > 0 ? lastMessageRef.current : null;
      if (attemptRef.current > 0) {
        countEvent('socket_reconnect');
      }
      attemptRef.current = 0;
      dispatch(sessionActions.updateSocket(true));
      socket.send(JSON.stringify({ logs: includeLogsRef.current }));
      markActivity();
      if (missedSince) {
        backfillEvents(missedSince);
      }
    };

    socket.onclose = async (event) => {
      dispatch(sessionActions.updateSocket(false));
      if (event.code === logoutCode) return;
      countEvent('socket_disconnect');
      try {
        const devicesResponse = await fetch('api/devices');
        if (socketRef.current !== socket) return;
        if (devicesResponse.ok) {
          dispatch(devicesActions.update(await devicesResponse.json()));
        }
        const positionsResponse = await fetch('api/positions');
        if (socketRef.current !== socket) return;
        if (positionsResponse.ok) {
          dispatch(sessionActions.updatePositions(await positionsResponse.json()));
        }
        if (devicesResponse.status === 401 || positionsResponse.status === 401) {
          navigate('/login');
        }
      } catch {
        // ignore errors
      }
      if (socketRef.current !== socket) return;
      clearReconnectTimeout();
      const delay = reconnectDelay(attemptRef.current);
      attemptRef.current += 1;
      dispatch(sessionActions.updateReconnectAt(Date.now() + delay));
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connectSocketRef.current?.();
      }, delay);
    };

    socket.onmessage = (event) => {
      markActivity();
      const data = JSON.parse(event.data);
      if (data.devices) {
        dispatch(devicesActions.update(data.devices));
      }
      if (data.positions) {
        // Command replies are read here, before the throttle can merge them away.
        const replies = data.positions.filter((position) => position.attributes?.result != null);
        if (replies.length) {
          dispatch(commandsActions.results(replies));
        }
        dispatch(sessionActions.updatePositions(data.positions));
      }
      if (data.events) {
        handleEventsRef.current(data.events);
      }
      if (data.logs) {
        dispatch(sessionActions.updateLogs(data.logs));
      }
    };
  }, [clearReconnectTimeout, dispatch, navigate, markActivity, backfillEvents]);

  connectSocketRef.current = connectSocket;

  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ logs: includeLogs }));
    }
  }, [includeLogs]);

  useAsyncTask(
    async ({ signal }) => {
      if (authenticated) {
        const response = await fetchOrThrow('api/devices', { signal });
        dispatch(devicesActions.refresh(await response.json()));
        nativePostMessage('authenticated');
        connectSocket();
        return () => {
          clearReconnectTimeout();
          socketRef.current?.close(logoutCode);
        };
      }
      return null;
    },
    [authenticated, dispatch, clearReconnectTimeout, connectSocket],
  );

  const handleNativeNotification = useCatchCallback(
    async (message) => {
      const eventId = message.data.eventId;
      if (eventId) {
        const response = await fetch(`api/events/${eventId}`);
        if (response.ok) {
          const event = await response.json();
          const eventWithMessage = {
            ...event,
            attributes: { ...event.attributes, message: message.notification.body },
          };
          handleEvents([eventWithMessage]);
        }
      }
    },
    [handleEvents],
  );

  useEffect(() => {
    handleNativeNotificationListeners.add(handleNativeNotification);
    return () => handleNativeNotificationListeners.delete(handleNativeNotification);
  }, [handleNativeNotification]);

  useEffect(() => {
    if (!authenticated) return;
    const reconnectIfNeeded = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connectSocket();
      } else if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send('{}');
        } catch {
          // test connection
        }
      }
    };
    const onVisibility = () => {
      if (!document.hidden) {
        reconnectIfNeeded();
      }
    };
    const reconnectNow = () => {
      attemptRef.current = 0;
      connectSocket();
    };
    window.addEventListener('online', reconnectIfNeeded);
    window.addEventListener(RECONNECT_NOW_EVENT, reconnectNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(RECONNECT_NOW_EVENT, reconnectNow);
      window.removeEventListener('online', reconnectIfNeeded);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authenticated, connectSocket]);

  return null;
};

export default SocketController;
