import { useRef } from 'react';

// Same items in the same order (by identity).
export const sameItems = (a, b) =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => item === b[index]));

// The previous array while the items are the same, so memoized children and map sources skip
// work when only something else changed (for example the selected vehicle's position).
export const useStableArray = (array) => {
  const ref = useRef(array);
  if (!sameItems(ref.current, array)) {
    ref.current = array;
  }
  return ref.current;
};
