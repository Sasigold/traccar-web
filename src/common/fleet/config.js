// Viper Fleet companion database (self-hosted Supabase on the VPS).
// The anon key is a public, RLS-restricted key by design; real access comes
// from the per-user JWT minted by the traccar-auth edge function.
//
// There is no default (FND-04): the address and key come from the build, VITE_FLEET_URL and
// VITE_FLEET_ANON_KEY, so development, the demo and pull requests never reach production by
// accident. Without them the fleet features are off. A production or staging build refuses to
// start without them (vite.config.js); an empty VITE_FLEET_URL turns the integration off on
// purpose. VITE_APP_ENV says which environment this build is for.
const env = import.meta.env;

export const fleetConfig = {
  url: (env.VITE_FLEET_URL ?? '').replace(/\/$/, ''),
  anonKey: env.VITE_FLEET_ANON_KEY ?? '',
  bucket: 'documents',
};

// production | staging | development | demo
export const appEnvironment = env.VITE_APP_ENV || (env.DEV ? 'development' : 'production');

export const isFleetConfigured = () => Boolean(fleetConfig.url && fleetConfig.anonKey);

export const fleetRoles = [
  'owner',
  'admin',
  'manager',
  'safety_officer',
  'dispatcher',
  'driver',
  'viewer',
];
