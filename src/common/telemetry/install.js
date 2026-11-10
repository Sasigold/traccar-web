// Turns telemetry on for this page (FND-06), once, from index.jsx. See config.js for the settings.
//
//   errors     uncaught errors and rejections, and what error boundaries catch, to Sentry/GlitchTip
//   metrics    web vitals, long tasks and counters, every 5 minutes and when the page is hidden,
//              to the fleet database (only while someone is signed in to it)
//   analytics  a page view per screen, unless the user or the browser opted out

import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { telemetryConfig } from './config';
import { createErrorReporter } from './errors';
import { metrics } from './metrics';
import { ANALYTICS_OPT_OUT_KEY, analyticsRequest, browserOptedOut } from './analytics';
import { routeTemplate } from './scrub';
import { appEnvironment, fleetConfig, isFleetConfigured } from '../fleet/config';
import { getFleetAccessToken } from '../fleet/session';

const FLUSH_MS = 5 * 60 * 1000;

export const release = import.meta.env.VITE_APP_VERSION || 'local';
export const config = telemetryConfig(import.meta.env);

let route = routeTemplate(typeof window !== 'undefined' ? window.location.pathname : '/');
const landingRoute = route;
let reporter = null;
let installed = false;
let lastPageView = null;

const language = () => document.documentElement.lang || undefined;

// The request that sends a batch to the fleet database. Pure, unit-tested.
export const metricsRequest = ({ url, anonKey, token, batch, environment }) => ({
  url: `${url}/rest/v1/rpc/record_client_metrics`,
  init: {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_release: release, p_environment: environment, p_metrics: batch }),
  },
});

export const flushMetrics = async () => {
  if (!config.metrics || !isFleetConfigured() || metrics.isEmpty()) {
    return;
  }
  // Only with a valid fleet session; before sign-in the counts wait (within the buffer's limits).
  const token = getFleetAccessToken();
  if (!token) {
    return;
  }
  const batch = metrics.take();
  const { url, init } = metricsRequest({
    url: fleetConfig.url,
    anonKey: fleetConfig.anonKey,
    token,
    batch,
    environment: appEnvironment,
  });
  try {
    const response = await fetch(url, init);
    // A server error may pass; anything else (no such function yet, refused) drops the batch.
    if (response.status >= 500) {
      metrics.restore(batch);
    }
  } catch {
    metrics.restore(batch);
  }
};

const analyticsAllowed = () => {
  if (!config.analytics || browserOptedOut(window.navigator)) {
    return false;
  }
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) !== 'true';
  } catch {
    return true;
  }
};

const anonymousId = () => {
  try {
    let id = window.sessionStorage.getItem('vfAnonId');
    if (!id) {
      id = window.crypto.randomUUID();
      window.sessionStorage.setItem('vfAnonId', id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
};

export const trackEvent = (name, props) => {
  if (!analyticsAllowed()) {
    return;
  }
  const request = analyticsRequest(config.analytics, {
    name,
    route,
    props,
    hostname: window.location.hostname,
    language: language(),
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    anonId: anonymousId(),
  });
  fetch(request.url, {
    method: 'POST',
    keepalive: true,
    credentials: 'omit',
    headers: { 'Content-Type': request.contentType },
    body: JSON.stringify(request.body),
  }).catch(() => {});
};

// Called by TelemetryRoute on every navigation.
export const setTelemetryRoute = (pathname) => {
  route = routeTemplate(pathname);
  // One page view per screen: "/device/1" then "/device/2" is the same screen.
  if (route !== lastPageView) {
    lastPageView = route;
    trackEvent(null);
  }
};

export const getTelemetryRoute = () => route;

// Error boundaries and the global handlers report here; counted even when no service is set.
export const reportError = (error, source = 'error') => {
  metrics.count(source === 'boundary' ? 'render_error' : 'js_error');
  reporter?.capture(error, { source });
};

export const telemetryStatus = () => ({
  errors: config.errors ? config.errors.host : null,
  analytics: config.analytics ? config.analytics.provider : null,
  metrics: config.metrics && isFleetConfigured(),
});

export const installTelemetry = (target = window) => {
  if (installed) {
    return;
  }
  installed = true;
  reporter = createErrorReporter({
    dsn: config.errors,
    release,
    environment: appEnvironment,
    getRoute: () => route,
    getLanguage: language,
  });

  target.addEventListener('error', (event) => {
    // Failed <img>/<script> loads also fire "error", without an error object.
    if (event.error || event.message) {
      reportError(event.error || event.message, 'error');
    }
  });
  target.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'rejection'));

  if (config.metrics && isFleetConfigured()) {
    // The first paint and loading metrics belong to the screen the visit started on; INP and
    // CLS to the screen where they were measured.
    const record = (sample, at) =>
      metrics.vital({ name: sample.name, value: sample.value, rating: sample.rating, route: at() });
    onLCP((sample) => record(sample, () => landingRoute));
    onFCP((sample) => record(sample, () => landingRoute));
    onTTFB((sample) => record(sample, () => landingRoute));
    onINP((sample) => record(sample, () => route));
    onCLS((sample) => record(sample, () => route));
    try {
      new PerformanceObserver((list) =>
        list.getEntries().forEach((entry) => metrics.longTask(entry.duration)),
      ).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long tasks are reported by Chromium only.
    }
    // After web-vitals' own listeners, so the final values are in the batch.
    target.document.addEventListener('visibilitychange', () => {
      if (target.document.visibilityState === 'hidden') {
        flushMetrics();
      }
    });
    target.setInterval(flushMetrics, FLUSH_MS);
  }
};
