import { createClient } from '@supabase/supabase-js';
import { fleetConfig } from './config';
import { getFreshFleetAccessToken } from './session';
import { ApiError } from '../util/apiError';
import { countEvent, counterName } from '../telemetry/metrics';

let client = null;

// ARC-06: after a write to the fleet database, the cached reads of that table (or of everything,
// for a function that writes) are fetched again, on every screen.
const WRITING_FUNCTION = /save|erase|archive|delete|remove|set_|close|assign|issue|import|sync/;
export const writtenTables = (method, url) => {
  const match = /\/rest\/v1\/(rpc\/)?([\w]+)/.exec(new URL(url, 'http://x').pathname);
  if (!match) return null;
  if (match[1]) return WRITING_FUNCTION.test(match[2]) ? ['*'] : null;
  return method && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD'
    ? [match[2]]
    : null;
};

const fetchAndInvalidate = async (input, init = {}) => {
  const response = await fetch(input, init);
  if (response.ok) {
    const url = typeof input === 'string' ? input : input.url;
    const tables = writtenTables(init.method || input.method, url);
    if (tables) {
      const { default: queryClient } = await import('../data/queryClient');
      tables.forEach((table) =>
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === 'fleet' && (table === '*' || query.queryKey[2] === table),
        }),
      );
    }
  }
  return response;
};

// One Supabase client for the whole app. Every request carries the JWT minted
// from the Traccar login (see session.js), so RLS sees the right profile.
export const getFleetClient = () => {
  if (!client) {
    client = createClient(fleetConfig.url, fleetConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: getFreshFleetAccessToken,
      global: { fetch: fetchAndInvalidate },
    });
  }
  return client;
};

// Supabase errors carry the code (42501 row security, 23505 duplicate) and the text; throw them
// as ApiError so the user reads what happened in their language.
export const unwrap = ({ data, error, status }) => {
  if (error) {
    const message = error.message || String(error);
    const kind = !status && /failed to fetch|network/i.test(message) ? 'network' : undefined;
    // FND-06: Supabase error codes, counted (fleet_error.42501, fleet_error.pgrst301...). A
    // cancelled request is not an error.
    if (!/abort/i.test(`${error.name || ''} ${message}`)) {
      countEvent(counterName('fleet_error', error.code || kind || status));
    }
    throw new ApiError({
      status: status || undefined,
      kind,
      code: error.code ? String(error.code) : undefined,
      endpoint: 'fleet',
      detail: [message, error.details, error.hint].filter(Boolean).join('\n'),
    });
  }
  return data;
};
