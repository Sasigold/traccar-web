import { OTHER } from './aggregate';

export const SLOTS = 6;

// Categorical color slots that stick to their entity: a key keeps its slot while it is
// on screen, new keys take the lowest free slot, and "Other" never takes one. Colors
// are never cycled; past six entities the rest is folded into "Other" upstream.
export const assignSlots = (keys, previous = {}) => {
  const result = {};
  const taken = new Set();
  keys.forEach((key) => {
    const slot = previous[key];
    if (key !== OTHER && Number.isInteger(slot) && slot < SLOTS && !taken.has(slot)) {
      result[key] = slot;
      taken.add(slot);
    }
  });
  keys.forEach((key) => {
    if (key === OTHER || result[key] !== undefined) {
      return;
    }
    let slot = 0;
    while (taken.has(slot) && slot < SLOTS) {
      slot += 1;
    }
    if (slot < SLOTS) {
      result[key] = slot;
      taken.add(slot);
    }
  });
  return result;
};
