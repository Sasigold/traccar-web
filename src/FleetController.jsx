import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fleetActions } from './store';
import { isFleetConfigured } from './common/fleet/config';
import { clearFleetSession, ensureFleetSession } from './common/fleet/session';
import { getFleetClient } from './common/fleet/client';
import { loadFleetFeatures } from './common/fleet/features';
import { useOutboxSync } from './common/fleet/useOutbox';
// The senders of what the driver area queues (ADM-10).
import './fleet/driverOutbox';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// Keeps a Viper Fleet session alive for the logged-in Traccar user.
// ensureFleetSession is a no-op while the current JWT is still fresh.
const FleetController = () => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.session.user?.id);
  // Share-link users never get a fleet database session (it would be organization-wide).
  const temporary = useSelector((state) => Boolean(state.session.user?.temporary));
  // ADM-10: what waits in the phone goes when the session is up and the line is back.
  useOutboxSync();

  useEffect(() => {
    if (!isFleetConfigured() || temporary) {
      dispatch(fleetActions.disabled());
      return undefined;
    }
    if (!userId) {
      clearFleetSession();
      dispatch(fleetActions.reset());
      return undefined;
    }

    let cancelled = false;
    const connect = async () => {
      try {
        const session = await ensureFleetSession(userId);
        if (!cancelled) {
          dispatch(
            fleetActions.ready({ profile: session.profile, permissions: session.permissions }),
          );
          // ADM-08: which fleet areas this database has.
          loadFleetFeatures().then(
            (features) => !cancelled && dispatch(fleetActions.features(features)),
            () => {},
          );
          // "Last seen" for the users screen; missing before the stage 3 migration, so ignored.
          getFleetClient()
            .rpc('touch_last_seen')
            .then(
              () => {},
              () => {},
            );
        }
      } catch (error) {
        if (!cancelled) {
          dispatch(fleetActions.failed(error.message));
        }
      }
    };

    dispatch(fleetActions.loading());
    connect();
    const interval = setInterval(connect, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, temporary, dispatch]);

  return null;
};

export default FleetController;
