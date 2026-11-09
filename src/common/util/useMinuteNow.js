import { useSyncExternalStore } from 'react';

// One shared clock that ticks every 30 s for durations such as "עומד 23 דק׳"; every row reads
// the same value instead of running its own timer.
const listeners = new Set();
let now = Date.now();
let timer = null;

const subscribe = (listener) => {
  listeners.add(listener);
  if (!timer) {
    // The clock was idle (nobody listening): catch up before the first tick.
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = null;
    }
  };
};

const getSnapshot = () => now;

export default () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
