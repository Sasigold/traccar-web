// Bridges the Traccar login into the Viper Fleet database.
// Traccar issues a short-lived session token; the traccar-auth edge function
// verifies it against Traccar and returns a Supabase JWT for the same person.
import fetchOrThrow from '../util/fetchOrThrow';
import { fleetConfig } from './config';

const STORAGE_KEY = 'fleetSession';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const TRACCAR_TOKEN_TTL_MS = 10 * 60 * 1000;

const load = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const save = (session) => {
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable (private mode) - keep the session in memory only
  }
};

let current = load();
let pending = null;

const isUsable = (session, traccarUserId) =>
  Boolean(session?.access_token) &&
  session.traccarUserId === traccarUserId &&
  session.expires_at * 1000 - Date.now() > REFRESH_MARGIN_MS;

export const getFleetSession = () => current;

export const getFleetAccessToken = () =>
  current?.access_token && current.expires_at * 1000 > Date.now() ? current.access_token : null;

export const clearFleetSession = () => {
  current = null;
  save(null);
};

export const ensureFleetSession = async (traccarUserId, { force = false } = {}) => {
  if (!force && isUsable(current, traccarUserId)) {
    return current;
  }
  if (pending) {
    return pending;
  }
  pending = (async () => {
    try {
      const expiration = new Date(Date.now() + TRACCAR_TOKEN_TTL_MS).toISOString();
      const tokenResponse = await fetchOrThrow('api/session/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ expiration }).toString(),
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
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = (await response.json()).error || '';
        } catch {
          // non-JSON error body
        }
        throw new Error(detail || `HTTP ${response.status}`);
      }
      current = { ...(await response.json()), traccarUserId };
      save(current);
      return current;
    } finally {
      pending = null;
    }
  })();
  return pending;
};
