import { useDispatch, useSelector } from 'react-redux';
import { useCatch } from '../../reactHelper';
import { fleetActions } from '../../store';
import { ensureFleetSession } from './session';

// Asks the edge function for a fresh token, so permissions granted after login take effect
// without logging out (and a failed connection can be tried again at once, ADM-21).
const useFleetReconnect = () => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.session.user?.id);
  return useCatch(async () => {
    dispatch(fleetActions.loading());
    try {
      const session = await ensureFleetSession(userId, { force: true });
      dispatch(fleetActions.ready({ profile: session.profile, permissions: session.permissions }));
    } catch (error) {
      dispatch(fleetActions.failed(error.message));
      throw error;
    }
  });
};

export default useFleetReconnect;
