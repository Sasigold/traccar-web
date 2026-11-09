import { createClient } from '@supabase/supabase-js';
import { fleetConfig } from './config';
import { getFreshFleetAccessToken } from './session';

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

// Supabase errors carry the useful text in `message`; make them throwable.
export const unwrap = ({ data, error }) => {
  if (error) {
    throw new Error(error.message || String(error));
  }
  return data;
};
