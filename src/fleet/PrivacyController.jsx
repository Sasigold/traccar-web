import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fleetActions } from '../store';
import { loadPrivacy } from '../common/fleet/privacyData';

const REFRESH_MS = 60 * 1000;

// Keeps the working hours and the current private periods in the store, so the live map can
// hide what the policy hides (ISR-03). A driver's switch shows within a minute.
const PrivacyController = () => {
  const dispatch = useDispatch();
  const ready = useSelector((state) => state.fleet.status === 'ready');

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      const now = Date.now();
      try {
        const privacy = await loadPrivacy(now - 24 * 60 * 60 * 1000, now + REFRESH_MS);
        if (!cancelled) {
          dispatch(fleetActions.privacy(privacy));
        }
      } catch {
        // Offline for a moment: keep the last rules.
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, dispatch]);

  return null;
};

export default PrivacyController;
