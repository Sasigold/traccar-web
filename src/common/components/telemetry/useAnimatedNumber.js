import { useEffect, useRef, useState } from 'react';
import { liveTween } from './liveTween';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Moves a displayed number from its previous value to the new target, so live telemetry counts
// up or down instead of jumping. When readings stream in (about one a second), each one glides
// at a constant pace over the time until the next is expected, so the needle sweeps
// continuously as the driver accelerates; sparse readings ease out and settle (see liveTween).
// Returns the target directly when the user asked for reduced motion or it is not a number.
export default (target) => {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const lastChangeRef = useRef(null);
  const frameRef = useRef();

  useEffect(() => {
    const now = performance.now();
    const gap = lastChangeRef.current == null ? null : now - lastChangeRef.current;
    lastChangeRef.current = now;
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
    const { duration, ease } = liveTween(gap);
    const step = (time) => {
      const progress = Math.min(1, Math.max(0, (time - now) / duration));
      const current = from + (target - from) * ease(progress);
      fromRef.current = current;
      setValue(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return value;
};
