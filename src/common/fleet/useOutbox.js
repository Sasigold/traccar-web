import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { flushOutbox, listOutbox, onOutboxChange } from './outbox';

const RETRY_MS = 60 * 1000;

// ADM-10: how many sends wait in the phone (for the "waiting to send (2)" chip).
export const useOutboxCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const update = () =>
      listOutbox()
        .then((items) => active && setCount(items.length))
        .catch(() => {});
    update();
    const unsubscribe = onOutboxChange(update);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return count;
};

// Sends what waits once the fleet session is up, whenever the line comes back, and every minute
// while something waits.
export const useOutboxSync = () => {
  const ready = useSelector((state) => Boolean(state.fleet.profile));
  const count = useOutboxCount();
  useEffect(() => {
    if (!ready) return undefined;
    const flush = () => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        flushOutbox().catch(() => {});
      }
    };
    window.addEventListener('online', flush);
    const timer = count ? setInterval(flush, RETRY_MS) : null;
    if (count) flush();
    return () => {
      window.removeEventListener('online', flush);
      if (timer) clearInterval(timer);
    };
  }, [ready, count]);
  return count;
};
