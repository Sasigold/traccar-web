import { useSyncExternalStore } from 'react';
import alarm from '../../resources/alarm.mp3';

// The alarm sound for critical events. Browsers block sound until the user has interacted with
// the page; when that happens the alert banner offers a button that turns sound on.
let audio;
let blocked = false;
const listeners = new Set();

const setBlocked = (value) => {
  if (blocked !== value) {
    blocked = value;
    listeners.forEach((listener) => listener());
  }
};

const play = () => {
  if (!audio) {
    audio = new Audio(alarm);
  }
  audio.currentTime = 0;
  const result = audio.play();
  result
    ?.then?.(() => setBlocked(false))
    ?.catch?.((error) => setBlocked(error?.name === 'NotAllowedError'));
};

export const playAlarm = play;

// Called from a click, which browsers accept as permission; the sound plays once to confirm.
export const enableSound = play;

export const useSoundBlocked = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => blocked,
    () => false,
  );
