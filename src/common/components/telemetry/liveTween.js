// How a live reading animates from the previous one. Devices that stream (about one reading a
// second) are animated at a constant pace across the gap between readings, so consecutive
// readings join into one continuous sweep, like a real needle under the throttle. Sparse readings
// (every 10 s and more, or the first change after a steady spell) ease out quickly and settle.

export const LIVE_GAP = 2500; // ms between readings still treated as a stream
const LIVE_MIN = 250; // ms, very fast streams still glide visibly
const LIVE_STRETCH = 1.05; // a reading that arrives a little late must not leave a pause
const SETTLE_DURATION = 700; // ms

const linear = (x) => x;
const easeOut = (x) => 1 - (1 - x) ** 3;

// gap: ms since the previous reading changed, or null for the first one.
export const liveTween = (gap) =>
  gap != null && gap <= LIVE_GAP
    ? { duration: Math.max(LIVE_MIN, gap * LIVE_STRETCH), ease: linear }
    : { duration: SETTLE_DURATION, ease: easeOut };
