import dayjs from 'dayjs';
import { formatTime } from './formatter';

// LIV-18: "live" means the vehicle reported a position in the last minute, not just that it is
// connected; an update from another day carries its date.
export const LIVE_WINDOW = 60 * 1000;

export const isLive = (fixTime, now = Date.now(), window = LIVE_WINDOW) => {
  if (!fixTime) return false;
  const age = now - dayjs(fixTime).valueOf();
  return age >= -LIVE_WINDOW && age < window;
};

export const formatUpdated = (fixTime, now = Date.now()) => {
  if (!fixTime) return '';
  return dayjs(fixTime).isSame(dayjs(now), 'day')
    ? formatTime(fixTime, 'time')
    : formatTime(fixTime, 'minutes');
};
