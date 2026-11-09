import { useState } from 'react';
import { useAsyncTask } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetProfile, useFleetStatus } from '../common/fleet/useFleet';

// The signed-in driver and the vehicle assigned to them now (ADM-09). The driver area fills
// both in and locks them: a driver never picks themselves or a vehicle from the whole fleet.
// undefined while loading; { driver: null } when the login is not linked to a driver.
const useDriverContext = (enabled = true) => {
  const status = useFleetStatus();
  const profile = useFleetProfile();
  const profileId = profile?.id;
  const [context, setContext] = useState(undefined);

  useAsyncTask(async () => {
    if (!enabled || status !== 'ready' || !profileId) {
      return;
    }
    const client = getFleetClient();
    const driver = unwrap(
      await client
        .from('drivers')
        .select('id, full_name, traccar_driver_id')
        .eq('profile_id', profileId)
        .maybeSingle(),
    );
    if (!driver) {
      setContext({ driver: null, assignment: null });
      return;
    }
    const assignments = unwrap(
      await client.from('current_assignments').select('*').eq('driver_id', driver.id).limit(1),
    );
    setContext({ driver, assignment: assignments?.[0] || null });
  }, [enabled, status, profileId]);

  return context;
};

export default useDriverContext;
