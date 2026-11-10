// Bridges the Traccar login into the Viper Fleet database.
// Traccar issues a short-lived session token; the traccar-auth edge function
// verifies it against Traccar and returns a Supabase JWT for the same person.
import fetchOrThrow from '../util/fetchOrThrow';
import { fleetConfig } from './config';
import { countEvent, counterName } from '../telemetry/metrics';

const STORAGE_KEY = 'fleetSession';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const TRACCAR_TOKEN_TTL_MS = 10 * 60 * 1000;

// The fleet JWT lives in sessionStorage (this tab only, gone when the tab closes) and is cleared
// on logout, so the next person at a shared PC can't reuse it. Older versions kept it in
// localStorage; that copy is removed on load.
const storage = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const load = () => {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const save = (session) => {
  try {
    if (session) {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      storage()?.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable (private mode) - keep the session in memory only
  }
};

let current = load();
let pending = null;
// The Traccar user the fleet session belongs to; set while someone is logged in.
let activeUserId = current?.traccarUserId ?? null;

const isUsable = (session, traccarUserId) =>
  Boolean(session?.access_token) &&
  session.traccarUserId === traccarUserId &&
  session.expires_at * 1000 - Date.now() > REFRESH_MARGIN_MS;

export const getFleetSession = () => current;

const validToken = () =>
  current?.access_token &&
  current.traccarUserId === activeUserId &&
  current.expires_at * 1000 > Date.now()
    ? current.access_token
    : null;

export const getFleetAccessToken = () => validToken();

// Used by the Supabase client before every request: renews the JWT when it is about to expire,
// instead of letting requests go out with the anonymous key (which RLS answers with empty lists).
export const getFreshFleetAccessToken = async () => {
  if (activeUserId != null && !isUsable(current, activeUserId)) {
    try {
      await ensureFleetSession(activeUserId);
    } catch {
      // the caller gets null and the request fails visibly; FleetController shows the error
    }
  }
  return validToken();
};

export const clearFleetSession = () => {
  current = null;
  activeUserId = null;
  save(null);
};

export const ensureFleetSession = async (traccarUserId, { force = false } = {}) => {
  activeUserId = traccarUserId;
  if (!force && isUsable(current, traccarUserId)) {
    return current;
  }
  if (pending) {
    return pending;
  }
  pending = (async () => {
    try {
      const expiration = new Date(Date.now() + TRACCAR_TOKEN_TTL_MS).toISOString();
      // FND-06: every failure to get a fleet token is counted, by step (token_failure.traccar,
      // token_failure.network, token_failure.<status of traccar-auth>).
      const tokenResponse = await fetchOrThrow('api/session/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ expiration }).toString(),
      }).catch((error) => {
        countEvent('token_failure.traccar');
        throw error;
      });
      const traccarToken = await tokenResponse.text();

      const response = await fetch(`${fleetConfig.url}/functions/v1/traccar-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: fleetConfig.anonKey,
          Authorization: `Bearer ${fleetConfig.anonKey}`,
        },
        body: JSON.stringify({ token: traccarToken }),
      }).catch((error) => {
        countEvent('token_failure.network');
        throw error;
      });
      if (!response.ok) {
        countEvent(counterName('token_failure', response.status));
        let detail = '';
        try {
          detail = (await response.json()).error || '';
        } catch {
          // non-JSON error body
        }
        throw new Error(detail || `HTTP ${response.status}`);
      }
      const session = { ...(await response.json()), traccarUserId };
      // A logout while the request was in flight wins.
      if (activeUserId !== traccarUserId) {
        throw new Error('Logged out');
      }
      current = session;
      save(current);
      return current;
    } finally {
      pending = null;
    }
  })();
  return pending;
};
