import { sessionActions } from './session';
import { devicesActions } from './devices';

const threshold = 3; // per second
const minInterval = 1500;
const maxInterval = 30000;
const scaleFactor = 1000;

// eslint-disable-next-line no-undef
const debugMode = process.env.NODE_ENV === 'development';
const debugLog = (message) => debugMode && console.log(message);

// The device the user is looking at (selected on the map or in the list) always bypasses the
// buffer, so its card, dials and marker stay live at the device's own rate (one update a second)
// even when the rest of a large fleet is batched.
const selectedOnly = (action, selectedId, key) => {
  const selected = action.payload.filter((item) => item[key] === selectedId);
  if (!selected.length) {
    return [null, action];
  }
  const rest = action.payload.filter((item) => item[key] !== selectedId);
  return [{ ...action, payload: selected }, rest.length ? { ...action, payload: rest } : null];
};

export default (store) => (next) => {
  const buffer = [];
  let throttled = false;
  let counter = 0;
  let currentInterval = minInterval;

  const flush = () => {
    const start = performance.now();

    const flushed = buffer.splice(0, buffer.length);

    const deviceUpdates = {};
    const positionUpdates = {};

    flushed.forEach((action) => {
      if (action.type === devicesActions.update.type) {
        action.payload.forEach((item) => (deviceUpdates[item.id] = item));
      } else if (action.type === sessionActions.updatePositions.type) {
        action.payload.forEach((item) => (positionUpdates[item.deviceId] = item));
      }
    });

    const mergedDeviceUpdates = Object.values(deviceUpdates);
    if (mergedDeviceUpdates.length) {
      next({ type: devicesActions.update.type, payload: mergedDeviceUpdates });
    }

    const mergedPositionUpdates = Object.values(positionUpdates);
    if (mergedPositionUpdates.length) {
      next({ type: sessionActions.updatePositions.type, payload: mergedPositionUpdates });
    }

    const totalTime = performance.now() - start;
    debugLog(
      `Flushed ${mergedDeviceUpdates.length + mergedPositionUpdates.length} / ${flushed.length} events in ${totalTime.toFixed(2)} ms`,
    );
    currentInterval = Math.min(Math.max(totalTime * scaleFactor, minInterval), maxInterval);
  };

  const tick = () => {
    try {
      if (throttled) {
        flush();
      }
    } catch (error) {
      // A failing flush (for example a reducer running after logout) must never stop the loop:
      // without the next tick every buffered update would be held forever.
      buffer.length = 0;
      debugLog(`Flush failed: ${error.message}`);
    }

    const shouldThrottle = (counter * 1000) / currentInterval > threshold;
    if (throttled != shouldThrottle) {
      debugLog(`Throttling ${shouldThrottle}`);
      throttled = shouldThrottle;
    }
    counter = 0;
    if (!throttled) currentInterval = minInterval;
    setTimeout(tick, currentInterval);
  };

  setTimeout(tick, currentInterval);

  return (action) => {
    // Logging out ends the session: forget what was buffered for it and start unthrottled.
    if (action.type === sessionActions.updateUser.type && !action.payload) {
      buffer.length = 0;
      throttled = false;
      counter = 0;
      return next(action);
    }

    if (
      action.type !== devicesActions.update.type &&
      action.type !== sessionActions.updatePositions.type
    ) {
      return next(action);
    }

    counter += 1;

    if (throttled) {
      const selectedId = store.getState().devices.selectedId;
      const key = action.type === devicesActions.update.type ? 'id' : 'deviceId';
      const [live, buffered] = selectedId ? selectedOnly(action, selectedId, key) : [null, action];
      if (buffered) {
        buffer.push(buffered);
      }
      if (!live) {
        return undefined;
      }
      // Updates buffered before the device was selected are older than this one: drop them so
      // the next flush does not roll the device back.
      for (let i = buffer.length - 1; i >= 0; i -= 1) {
        if (buffer[i].type === live.type) {
          const [, others] = selectedOnly(buffer[i], selectedId, key);
          if (others) {
            buffer[i] = others;
          } else {
            buffer.splice(i, 1);
          }
        }
      }
      return next(live);
    }

    if ((counter * 1000) / currentInterval > threshold) {
      if (!throttled) debugLog(`Throttling started`);
      throttled = true;
    }

    return next(action);
  };
};
