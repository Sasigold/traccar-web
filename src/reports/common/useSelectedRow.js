import { useCallback, useEffect, useRef } from 'react';

// REP-11: the row shown on the map stays in view: once the map has opened above the table, the
// selected row is scrolled back to (only as far as needed).
export default (selected) => {
  const rowRef = useRef(null);
  useEffect(() => {
    if (!selected) return undefined;
    const frame = requestAnimationFrame(() =>
      rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  return useCallback((node) => {
    rowRef.current = node;
  }, []);
};
