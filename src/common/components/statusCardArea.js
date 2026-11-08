// Where the vehicle card sits on screen, for the follow camera (MapSelectedDevice): it keeps the
// followed vehicle in the largest part of the map the card does not cover. StatusCard registers
// its card element and reports when it is dragged; size changes are observed here.

let element = null;
let observer = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

export const setStatusCardElement = (next) => {
  if (next === element) {
    return;
  }
  observer?.disconnect();
  observer = null;
  element = next;
  if (element && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(notify);
    observer.observe(element);
  }
  notify();
};

export const statusCardMoved = () => notify();

export const getStatusCardRect = () => element?.getBoundingClientRect() ?? null;

export const subscribeStatusCard = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Vertical offset (px from the map's center, negative is up) of the middle of the largest band
// of the map that the card leaves uncovered. 0 when there is no card or it is beside the map.
export const uncoveredOffset = (mapRect, cardRect) => {
  if (
    !cardRect ||
    cardRect.bottom <= mapRect.top ||
    cardRect.top >= mapRect.bottom ||
    cardRect.right <= mapRect.left ||
    cardRect.left >= mapRect.right
  ) {
    return 0;
  }
  const above = Math.max(0, cardRect.top - mapRect.top);
  const below = Math.max(0, mapRect.bottom - cardRect.bottom);
  const center = (mapRect.top + mapRect.bottom) / 2;
  const target = above >= below ? mapRect.top + above / 2 : cardRect.bottom + below / 2;
  return target - center;
};
