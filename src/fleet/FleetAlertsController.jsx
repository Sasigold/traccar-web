import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fleetActions } from '../store';
import { useFleetPermission } from '../common/fleet/useFleet';
import { countOpenAlerts } from './alerts';

const REFRESH_MS = 10 * 60 * 1000;

// Keeps the number of open fleet alerts (expiring documents) for the bell.
const FleetAlertsController = () => {
  const dispatch = useDispatch();
  const allowed = useFleetPermission('alerts.read');

  useEffect(() => {
    if (!allowed) {
      dispatch(fleetActions.alertsCount(0));
      return undefined;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const count = await countOpenAlerts();
        if (!cancelled) {
          dispatch(fleetActions.alertsCount(count));
        }
      } catch {
        // The bell keeps the last known count; the alerts page shows the error.
      }
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [allowed, dispatch]);

  return null;
};

export default FleetAlertsController;
