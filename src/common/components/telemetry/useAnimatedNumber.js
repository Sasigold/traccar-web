import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const easeOut = (x) => 1 - (1 - x) ** 3;

// Eases a displayed number from its previous value to the new target, so live
// telemetry counts up or down instead of jumping. Returns the target directly
// when the user asked for reduced motion or the value is not a number.
export default (target, duration = 700) => {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef();

  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target) || prefersReducedMotion()) {
      fromRef.current = target;
      setValue(target);
      return undefined;
    }
    const from = typeof fromRef.current === 'number' ? fromRef.current : 0;
    if (from === target) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const current = from + (target - from) * easeOut(progress);
      fromRef.current = current;
      setValue(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
};
