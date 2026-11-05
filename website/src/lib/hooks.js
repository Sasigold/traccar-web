import { useEffect, useRef, useState } from 'react';

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, k) => a + (b - a) * k;

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Adds `is-in` to every [data-reveal] element once it scrolls into view.
export const useRevealAll = () => {
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]');
    if (reducedMotion()) {
      nodes.forEach((n) => n.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
};

// True while the element is on screen.
export const useInView = (threshold = 0.2) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
};

// Writes the scroll progress of an element through the viewport (0 when its top
// meets the bottom of the screen, 1 when its bottom meets the top) into the CSS
// variable --p, without re-rendering.
export const useScrollVar = (ref, { start = 1, end = 0 } = {}) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const from = vh * start;
      const to = vh * end - r.height;
      const p = clamp((from - r.top) / (from - to));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref, start, end]);
};

// Counts up to `value` the first time `active` turns true.
export const useCountUp = (value, active, duration = 1400) => {
  const [n, setN] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => {
    if (!active || doneRef.current) return undefined;
    doneRef.current = true;
    if (reducedMotion()) {
      setN(value);
      return undefined;
    }
    let raf;
    let finished = false;
    const t0 = performance.now();
    const tick = (t) => {
      const k = clamp((t - t0) / duration);
      setN(Math.round(value * (1 - (1 - k) ** 4)));
      if (k < 1) raf = requestAnimationFrame(tick);
      else finished = true;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (!finished) doneRef.current = false;
    };
  }, [active, value, duration]);
  return n;
};
