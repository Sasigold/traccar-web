// Checks the environment of a build before it starts (FND-04), run by vite.config.js. Pure.
//
// A production or staging build must say which fleet database it talks to (VITE_FLEET_URL and
// VITE_FLEET_ANON_KEY; an empty URL turns the integration off on purpose), and a staging build
// must not talk to the production database.

// The production fleet database. Listed so that staging can never be pointed at it.
export const PRODUCTION_FLEET_HOSTS = ['viper-fleet-api.srv2122641.hstgr.cloud'];

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

// Returns the problems, empty when the build may go ahead.
export const buildEnvProblems = (mode, env) => {
  if (mode !== 'production' && mode !== 'staging') {
    return [];
  }
  const problems = [];
  const url = env.VITE_FLEET_URL;
  if (url === undefined) {
    problems.push(
      `VITE_FLEET_URL is not set for the ${mode} build (set it, or set it empty to build without the fleet database).`,
    );
  } else if (url !== '') {
    if (!/^https:\/\//.test(url) || !hostOf(url)) {
      problems.push(`VITE_FLEET_URL must be an https address, not "${url}".`);
    }
    if (!env.VITE_FLEET_ANON_KEY) {
      problems.push('VITE_FLEET_ANON_KEY is not set.');
    }
    if (mode === 'staging' && PRODUCTION_FLEET_HOSTS.includes(hostOf(url))) {
      problems.push('The staging build points at the production fleet database.');
    }
  }
  if ((env.VITE_APP_ENV || 'production') !== mode) {
    problems.push(`VITE_APP_ENV is "${env.VITE_APP_ENV || ''}" but the build mode is "${mode}".`);
  }
  return problems;
};
