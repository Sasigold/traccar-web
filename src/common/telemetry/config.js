// What this build reports, and where (FND-06). Everything comes from the build environment, none
// of it is secret, and the outside services are off unless set:
//
//   VITE_ERROR_DSN            Sentry or GlitchTip project DSN (same protocol): error reports
//   VITE_ANALYTICS_PROVIDER   umami | plausible | posthog
//   VITE_ANALYTICS_URL        the self-hosted service, e.g. https://analytics.example.com
//   VITE_ANALYTICS_SITE       Umami website id, Plausible domain, or PostHog project key
//   VITE_CLIENT_METRICS       "off" stops web vitals and counters going to the fleet database
//                             (on by default: they stay in our own database, with nothing personal)
//
// docs/OBSERVABILITY.md has the setup.

import { parseDsn } from './errors.js';
import { parseAnalytics } from './analytics.js';

export const telemetryConfig = (env) => ({
  errors: parseDsn(env.VITE_ERROR_DSN),
  analytics: parseAnalytics({
    provider: env.VITE_ANALYTICS_PROVIDER,
    url: env.VITE_ANALYTICS_URL,
    site: env.VITE_ANALYTICS_SITE,
  }),
  metrics: env.VITE_CLIENT_METRICS !== 'off',
});

// Problems with telemetry settings that were given but cannot work, for the build to refuse them
// (a typo would otherwise switch reporting off without anyone noticing).
export const telemetryEnvProblems = (env) => {
  const problems = [];
  const config = telemetryConfig(env);
  if (env.VITE_ERROR_DSN && !config.errors) {
    problems.push('VITE_ERROR_DSN is not a valid https DSN (https://<key>@<host>/<project>).');
  }
  const anyAnalytics =
    env.VITE_ANALYTICS_PROVIDER || env.VITE_ANALYTICS_URL || env.VITE_ANALYTICS_SITE;
  if (anyAnalytics && !config.analytics) {
    problems.push(
      'VITE_ANALYTICS_PROVIDER (umami, plausible or posthog), VITE_ANALYTICS_URL (https) and VITE_ANALYTICS_SITE must be set together.',
    );
  }
  if (env.VITE_CLIENT_METRICS && !['on', 'off'].includes(env.VITE_CLIENT_METRICS)) {
    problems.push('VITE_CLIENT_METRICS must be "on" or "off".');
  }
  return problems;
};
