# Observability (FND-06)

What the interface reports about itself, where it goes, and how to turn each part on. Three
parts, each independent:

| Part | Where it goes | Default | Turned on by |
|---|---|---|---|
| Error reports | Sentry or GlitchTip (same protocol) | off | `VITE_ERROR_DSN` |
| Browser metrics: web vitals, long tasks, operational counters | our fleet database (`client_metrics`) | **on** while the fleet database is configured | `VITE_CLIENT_METRICS=off` stops it |
| Product analytics: which screens are used | Umami, Plausible or PostHog, self-hosted | off | `VITE_ANALYTICS_PROVIDER`, `VITE_ANALYTICS_URL`, `VITE_ANALYTICS_SITE` |

The code is in `src/common/telemetry/`. Nothing here is secret: a DSN key can only submit events, and
an analytics site id or PostHog project key is public by design. The only secret is the token that
uploads source maps, and it lives in one CI job (below).

## Owner decisions still open

1. **Error service:** GlitchTip on the VPS (free, the data stays on our server, needs a container and
   Postgres/Redis) or Sentry (hosted, free tier, the data goes to the US). The code works with both;
   only the DSN changes.
2. **Product analytics:** Umami (lightest, one container), Plausible (also simple), PostHog
   (much more: funnels and feature flags, but heavier) or none.

Until they are set nothing is sent anywhere outside our own database.

## What is sent, and what never is

- **Every part:** the release (`1.0.0+<commit>`), the environment, the screen as a template
  (`/settings/device/:id`: numbers, ids and tokens in the address become `:id` / `:token`, the query
  string and fragment are dropped) and the language.
- **Error reports** add the error type, message and stack. Messages and addresses go through
  `scrub.js` first: tokens, API keys, e-mail addresses, Israeli phone numbers, ID numbers, licence
  plates and coordinates are replaced. No user, no e-mail, no organization. Noise is not sent: old
  chunks after a deploy (counted instead; the page reloads, FND-05), cancelled requests,
  `ResizeObserver loop`, cross-origin "Script error." and errors that come only from browser
  extensions. At most 20 events per page load, the same error at most once a minute.
- **Browser metrics** go to `record_client_metrics` with the user's own fleet token. The rows carry
  the organization (to see which customer suffers) but never the user. 500 rows per user per hour
  at most, kept 30 days.
- **Analytics** sends one page view per screen. No third-party script is loaded: the app posts to the
  service's own endpoint. No cookies; for PostHog a random id that lives only in the tab
  (`sessionStorage`) and no person profile (`$process_person_profile: false`). Users can turn it off
  in Preferences → System ("נתוני שימוש אנונימיים"), and a browser with Do Not Track or Global
  Privacy Control never sends.

## The counters

| Counter | Counted in | Means |
|---|---|---|
| `js_error`, `render_error` | `install.js`, `ErrorBoundary.jsx` | uncaught errors / screens an error boundary caught (counted even without an error service) |
| `chunk_load_error` | `staleBuild.js`, `ErrorBoundary.jsx` | a script of an older build failed to load |
| `socket_disconnect`, `socket_reconnect` | `SocketController.jsx` | the live connection dropped / came back (logout is not counted) |
| `token_failure.<step>` | `fleet/session.js` | getting a fleet token failed: `traccar`, `network` or the HTTP status of `traccar-auth` |
| `api_error.<status>` | `util/fetchOrThrow.js` | the tracking server answered 401 or 5xx, or `network` / `timeout` |
| `fleet_error.<code>` | `fleet/client.js` | a Supabase error code (`42501`, `pgrst301`, `network`...) |

Long tasks (over 50 ms, Chromium only) are summed per batch: count, total and the longest.

Platform administrators see all of it in **ניהול השירות → בריאות הממשק** (`/admin/health`), per release
and period: the 75th percentile of each web vital with Google's good / needs improvement / slow
thresholds, the share rated good, the counters, and which reporting services the running build has.

## Setting up error reports

1. Create a project in GlitchTip or Sentry (platform: JavaScript / browser) and copy its DSN.
2. Set the repository variable `STAGING_ERROR_DSN` (and later `PRODUCTION_ERROR_DSN`). The next build
   sends errors. A DSN that does not parse stops the build, so a typo never switches reporting off
   silently.
3. **Source maps (readable stack traces).** A build with a DSN makes hidden source maps: the scripts do
   not link to them, `deploy/sourcemaps.sh split` moves them out of `build/` before the site artifact
   is made, and `deploy/deploy.sh` never uploads `*.map`. To upload them to the error service, set:
   - variables `ERROR_SOURCEMAPS_URL` (`https://glitchtip.example.com` or `https://sentry.io`),
     `ERROR_SOURCEMAPS_ORG` (the organization slug), `STAGING_ERROR_PROJECT` /
     `PRODUCTION_ERROR_PROJECT` (the project slug);
   - secret `ERROR_AUTH_TOKEN` (an auth token with project:releases scope).

   The `sourcemaps` job in `deploy.yml` / `promote.yml` then runs `sentry-cli` (it works with both
   services) for the release in `version.json`. It holds only that token, never the server key.
4. In the service, scrub IP addresses (GlitchTip: project settings; Sentry: "Prevent storing of IP
   addresses") and set the data retention.

## Setting up analytics

1. Run the service (for example Umami in a container behind the reverse proxy) and add the site.
2. Set `STAGING_ANALYTICS_PROVIDER` (`umami`, `plausible` or `posthog`), `STAGING_ANALYTICS_URL`
   (https) and `STAGING_ANALYTICS_SITE` (Umami website id, Plausible domain or PostHog project key).
   All three or none: a partial set stops the build.
3. Add a line about it to the privacy notice (processing of usage statistics, no personal data,
   how to opt out).

## Content Security Policy

When the security headers (SEC-10) are added at the reverse proxy, `connect-src` needs the
error service and analytics hosts in addition to Traccar and Supabase.

## Locally

`npm start` and the demo send browser metrics to the fleet database they are configured with (the demo's
never resolves, so nothing leaves). To try error reports, put `VITE_ERROR_DSN` in
`.env.development.local`.
