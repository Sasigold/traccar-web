import { useLayoutEffect, useRef } from 'react';
import { motion } from '../../common/theme/tokens';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// FLIP reflow animation: after the layout changes, every widget that moved slides
// from its old place to the new one (translate only, so content never stretches).
const useFlip = (
  containerRef,
  signature,
  { enabled = true, duration = motion.duration.slow, easing = motion.easing.standard } = {},
) => {
  const rectsRef = useRef(new Map());
  const widthRef = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const next = new Map();
    container.querySelectorAll('[data-flip]').forEach((element) => {
      const rect = element.getBoundingClientRect();
      next.set(element.dataset.flip, {
        element,
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
      });
    });
    const sameWidth = Math.abs(containerRect.width - widthRef.current) < 1;
    if (enabled && sameWidth && !reduced()) {
      next.forEach((current, key) => {
        const before = rectsRef.current.get(key);
        if (!before) {
          current.element.animate(
            [
              { opacity: 0, transform: 'scale(0.98)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration, easing },
          );
          return;
        }
        const dx = before.x - current.x;
        const dy = before.y - current.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          current.element.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
            { duration, easing },
          );
        }
      });
    }
    rectsRef.current = next;
    widthRef.current = containerRect.width;
  }, [containerRef, signature, enabled, duration, easing]);
};

export default useFlip;
