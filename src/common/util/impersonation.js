import fetchOrThrow from './fetchOrThrow';
import { getFleetClient } from '../fleet/client';
import store from '../../store';

const fleetReady = () => store.getState().fleet.status === 'ready';

// SEC-13: "log in as" another user. The reason and who did it are recorded in the fleet audit
// log before the Traccar session is switched, and kept in this browser so the switched session
// shows a banner with the way back.
const KEY = 'impersonation';

const record = async (event, target, by, reason) => {
  try {
    if (!fleetReady()) return;
    await getFleetClient().rpc('record_impersonation', {
      p_event: event,
      p_target_user: target.id,
      p_target_name: target.name,
      p_by_name: by,
      p_reason: reason || null,
    });
  } catch {
    // Recording must not block support; the server log still has the switch.
  }
};

export const currentImpersonation = (userId) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY));
    return value && value.targetId === userId ? value : null;
  } catch {
    return null;
  }
};

export const startImpersonation = async (target, by, reason) => {
  await record('start', target, `${by.name} <${by.email}>`, reason);
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      targetId: target.id,
      targetName: target.name,
      byName: by.name,
      reason,
      at: new Date().toISOString(),
    }),
  );
  await fetchOrThrow(`api/session/${target.id}`);
  window.location.replace(document.baseURI);
};

// Going back: the end is recorded, the session is closed, and the user signs in as themselves.
export const endImpersonation = async (current, logout) => {
  await record('end', { id: current.targetId, name: current.targetName }, current.byName, null);
  window.localStorage.removeItem(KEY);
  await logout();
};

export const clearImpersonation = () => window.localStorage.removeItem(KEY);
