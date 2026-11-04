// Viper Fleet companion database (self-hosted Supabase on the VPS).
// The anon key is a public, RLS-restricted key by design; real access comes
// from the per-user JWT minted by the traccar-auth edge function.
// Override at build time with VITE_FLEET_URL / VITE_FLEET_ANON_KEY,
// or set VITE_FLEET_URL to an empty string to disable the integration.
const env = import.meta.env;

export const fleetConfig = {
  url: (env.VITE_FLEET_URL ?? 'https://viper-fleet-api.srv2122641.hstgr.cloud').replace(/\/$/, ''),
  anonKey:
    env.VITE_FLEET_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzODAyMjQ4LCJleHAiOjE5NTE0ODIyNDh9.2VsAyl2IFUy3QarPwReLOwcKhSthi62FZIyxs5YyrxU',
  bucket: 'documents',
};

export const isFleetConfigured = () => Boolean(fleetConfig.url && fleetConfig.anonKey);

export const fleetRoles = ['owner', 'admin', 'manager', 'dispatcher', 'driver', 'viewer'];
