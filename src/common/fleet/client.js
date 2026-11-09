import { createClient } from '@supabase/supabase-js';
import { fleetConfig } from './config';
import { getFreshFleetAccessToken } from './session';
import { ApiError } from '../util/apiError';

let client = null;

// One Supabase client for the whole app. Every request carries the JWT minted
// from the Traccar login (see session.js), so RLS sees the right profile.
export const getFleetClient = () => {
  if (!client) {
    client = createClient(fleetConfig.url, fleetConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: getFreshFleetAccessToken,
    });
  }
  return client;
};

// Supabase errors carry the code (42501 row security, 23505 duplicate) and the text; throw them
// as ApiError so the user reads what happened in their language.
export const unwrap = ({ data, error, status }) => {
  if (error) {
    const message = error.message || String(error);
    throw new ApiError({
      status: status || undefined,
      kind: !status && /failed to fetch|network/i.test(message) ? 'network' : undefined,
      code: error.code ? String(error.code) : undefined,
      endpoint: 'fleet',
      detail: [message, error.details, error.hint].filter(Boolean).join('\n'),
    });
  }
  return data;
};
