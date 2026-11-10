import { useEffect, useState } from 'react';
import { motion } from './tokens';

// BRD-03, the motion language: motion says that something happened. No endless decorative
// loops; one beat when an event arrives (a new position, a status change, a new alert), entries
// and exits from theme.tokens.motion, and nothing at all when the user asked for less motion.
const QUERY = '(prefers-reduced-motion: reduce)';

export const reducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);

// The current preference, kept live: it follows a change in the system settings.
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(reducedMotion);
  useEffect(() => {
    const query = window.matchMedia?.(QUERY);
    if (!query) return undefined;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

// One beat on an element (Web Animations API), unless motion is reduced.
export const beat = (
  element,
  keyframes,
  duration = motion.duration.base,
  easing = motion.easing.standard,
) => {
  if (!element?.animate || reducedMotion()) return null;
  return element.animate(keyframes, { duration, easing });
};

export const PAGE_FADE = [{ opacity: 0 }, { opacity: 1 }];
export const BADGE_BUMP = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.15)' },
  { transform: 'scale(1)' },
];
