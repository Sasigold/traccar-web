import { useCallback, useEffect, useRef, useState } from 'react';

// Measured content size of an element (ResizeObserver, one update per frame).
// Returns [ref callback, { width, height }].
const useElementSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef(null);
  const frameRef = useRef(0);

  const ref = useCallback((element) => {
    observerRef.current?.disconnect();
    if (!element) {
      return;
    }
    const measure = (entry) => {
      const box = entry?.contentRect ?? element.getBoundingClientRect();
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    observerRef.current = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => measure(entry));
    });
    observerRef.current.observe(element);
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return [ref, size];
};

export default useElementSize;
