import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import { messagesActions, motionActions } from '../store';
import { useAttributePreference } from '../common/util/preferences';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

const buildSegments = (events, fromTimestamp, toTimestamp) => {
  const segments = [];
  let cursor = fromTimestamp;
  const firstEvent = events.length ? events[0] : null;
  let state = 'stopped';
  if (firstEvent && firstEvent.type === 'deviceStopped') {
    state = 'moving';
  }

  events.forEach((event) => {
    const timestamp = dayjs(event.eventTime).valueOf();
    const clampedTimestamp = Math.max(fromTimestamp, Math.min(toTimestamp, timestamp));
    if (clampedTimestamp > cursor) {
      segments.push({
        type: state,
        value: clampedTimestamp - cursor,
      });
    }
    state = event.type === 'deviceMoving' ? 'moving' : 'stopped';
    cursor = clampedTimestamp;
  });

  if (toTimestamp > cursor) {
    segments.push({
      type: state,
      value: toTimestamp - cursor,
    });
  }

  if (!segments.length) {
    return [{ type: 'stopped', value: 1 }];
  }

  return segments;
};

// PRF-05: after the first 24 hours, each refresh asks only for what happened since the last one
// (with a minute of overlap), keeps the last 24 hours, and drops repeats. Pure, tested.
export const OVERLAP_MS = 60000;
export const mergeMotionEvents = (previous, incoming, fromTimestamp) => {
  const byId = new Map();
  [...previous, ...incoming].forEach((event) => byId.set(event.id, event));
  return [...byId.values()]
    .filter((event) => dayjs(event.eventTime).valueOf() >= fromTimestamp)
    .sort((a, b) => dayjs(a.eventTime).valueOf() - dayjs(b.eventTime).valueOf());
};

const MotionController = () => {
  const dispatch = useDispatch();

  const deviceSecondary = useAttributePreference('deviceSecondary', '');

  useAsyncTask(
    async ({ signal }) => {
      if (deviceSecondary !== 'motion') {
        dispatch(motionActions.clear());
        return;
      }

      let active = true;
      let known = [];
      let lastTo = null;

      const refreshMotion = async () => {
        const to = dayjs();
        const from = to.subtract(24, 'hour');
        const query = new URLSearchParams({
          from: (lastTo ? lastTo.subtract(OVERLAP_MS, 'millisecond') : from).toISOString(),
          to: to.toISOString(),
        });
        query.append('type', 'deviceMoving');
        query.append('type', 'deviceStopped');

        const response = await fetchOrThrow(`api/reports/events?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          signal,
        });
        known = mergeMotionEvents(known, await response.json(), from.valueOf());
        lastTo = to;
        const events = known;

        const groupedEvents = {};
        events.forEach((event) => {
          if (!groupedEvents[event.deviceId]) {
            groupedEvents[event.deviceId] = [];
          }
          groupedEvents[event.deviceId].push(event);
        });
        const nextMotion = Object.fromEntries(
          Object.entries(groupedEvents).map(([deviceId, deviceEvents]) => [
            deviceId,
            buildSegments(deviceEvents, from.valueOf(), to.valueOf()),
          ]),
        );

        if (active) {
          dispatch(motionActions.set(nextMotion));
        }
      };

      await refreshMotion();
      const interval = setInterval(
        () => {
          refreshMotion().catch((error) => {
            if (error.name !== 'AbortError') {
              dispatch(messagesActions.push(error.message));
            }
          });
        },
        5 * 60 * 1000,
      );

      return () => {
        active = false;
        clearInterval(interval);
      };
    },
    [deviceSecondary, dispatch],
  );

  return null;
};

export default MotionController;
