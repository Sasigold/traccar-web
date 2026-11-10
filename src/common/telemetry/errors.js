// Error reporting (FND-06) over the Sentry envelope protocol, which both Sentry and GlitchTip
// (self-hosted on the VPS) accept, so the owner can pick either without a code change. Off unless
// the build sets VITE_ERROR_DSN. The DSN's key is public by design (it can only submit events).
//
// No SDK: a small sender keeps the bundle light and makes it plain what is sent. An event has the
// release ("1.0.0+<commit>", matched to the private source maps uploaded by the deploy), the
// environment, the page as a template ("/settings/device/:id"), the language, and the error with
// its stack. Messages and addresses are scrubbed (scrub.js); no user, e-mail, IP or organization.

import { routeTemplate, scrubText, scrubUrl } from './scrub.js';

// "https://<key>@<host>[/<path>]/<project>" -> where to send and how to sign it.
export const parseDsn = (dsn) => {
  if (!dsn) {
    return null;
  }
  try {
    const url = new URL(dsn);
    const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
    const parts = url.pathname.split('/').filter(Boolean);
    const project = parts.pop();
    if (!url.username || !project || !/^\d+$/.test(project)) {
      return null;
    }
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
      return null;
    }
    const prefix = parts.length ? `/${parts.join('/')}` : '';
    const query = new URLSearchParams({
      sentry_key: url.username,
      sentry_version: '7',
      sentry_client: 'viper-fleet/1.0',
    });
    return {
      host: url.host,
      project,
      endpoint: `${url.protocol}//${url.host}${prefix}/api/${project}/envelope/?${query}`,
    };
  } catch {
    return null;
  }
};

const CHROME =
  /^\s*at (?:(.+?) \()?((?:https?|blob|file|chrome-extension|moz-extension|webpack|\/).*?):(\d+):(\d+)\)?\s*$/;
const GECKO =
  /^\s*(.*?)@((?:https?|blob|file|chrome-extension|moz-extension|safari-extension|webpack|\/).*?):(\d+):(\d+)\s*$/;
const MAX_FRAMES = 50;

const isExtension = (file) => /^(chrome|moz|safari(-web)?)-extension:/.test(file);

// Stack text (Chromium, Firefox, Safari) -> Sentry frames, oldest call first.
export const parseStack = (stack) => {
  if (!stack) {
    return [];
  }
  const frames = [];
  String(stack)
    .split('\n')
    .forEach((line) => {
      const match = CHROME.exec(line) || GECKO.exec(line);
      if (match && frames.length < MAX_FRAMES) {
        const [, fn, file, lineno, colno] = match;
        frames.push({
          function: fn ? scrubText(fn).slice(0, 120) : '?',
          filename: scrubUrl(file),
          lineno: Number(lineno),
          colno: Number(colno),
          in_app: !isExtension(file) && !/node_modules/.test(file),
        });
      }
    });
  return frames.reverse();
};

// Errors that are not bugs of ours, or that are handled elsewhere: an old chunk after a deploy
// (staleBuild.js reloads, and it is counted), a cancelled request, the browser's resize-observer
// notice, cross-origin "Script error." without details, and errors coming only from extensions.
export const shouldIgnore = (error, frames) => {
  const name = error?.name || '';
  const message = String(error?.message ?? error ?? '');
  if (name === 'AbortError' || /^(Script error\.?)?$/.test(message.trim())) {
    return true;
  }
  if (
    /ResizeObserver loop|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(
      message,
    )
  ) {
    return true;
  }
  return frames.length > 0 && frames.every((frame) => isExtension(frame.filename));
};

const randomId = () => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// One Sentry event. `source`: boundary (caught by an error boundary) | error | rejection.
export const buildEvent = ({
  error,
  source,
  release,
  environment,
  route,
  language,
  now = Date.now(),
  eventId = randomId(),
}) => {
  const isError =
    error instanceof Error || (error && typeof error === 'object' && 'message' in error);
  const frames = parseStack(isError ? error.stack : null);
  return {
    event_id: eventId,
    timestamp: now / 1000,
    platform: 'javascript',
    level: 'error',
    logger: 'viper-fleet',
    release,
    environment,
    transaction: routeTemplate(route),
    tags: { source, route: routeTemplate(route), language: language || 'unknown' },
    exception: {
      values: [
        {
          type: (isError && error.name) || 'Error',
          value: scrubText(isError ? error.message : error),
          ...(frames.length ? { stacktrace: { frames } } : {}),
          mechanism: { type: source, handled: source === 'boundary' },
        },
      ],
    },
  };
};

export const envelope = (event, now = Date.now()) =>
  [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date(now).toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

const defaultTransport = (url, body) =>
  fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    credentials: 'omit',
    // text/plain needs no CORS preflight; both services read the envelope from the body.
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
  }).catch(() => {});

// Sends at most `maxPerPage` events per page load and the same error at most once a minute, so a
// render loop cannot flood the service. Returns whether the event was sent.
export const createErrorReporter = ({
  dsn,
  release,
  environment,
  getRoute = () => '/',
  getLanguage = () => undefined,
  transport = defaultTransport,
  now = () => Date.now(),
  maxPerPage = 20,
  repeatMs = 60000,
}) => {
  const target = typeof dsn === 'string' ? parseDsn(dsn) : dsn;
  const recent = new Map();
  let sent = 0;
  return {
    enabled: Boolean(target),
    capture(error, { source = 'error' } = {}) {
      if (!target || sent >= maxPerPage) {
        return false;
      }
      const frames = parseStack(error?.stack);
      if (shouldIgnore(error, frames)) {
        return false;
      }
      const top = frames[frames.length - 1];
      const key = `${error?.name}|${error?.message ?? error}|${top?.filename}:${top?.lineno}`;
      const time = now();
      if (recent.has(key) && time - recent.get(key) < repeatMs) {
        return false;
      }
      recent.set(key, time);
      sent += 1;
      const event = buildEvent({
        error,
        source,
        release,
        environment,
        route: getRoute(),
        language: getLanguage(),
        now: time,
      });
      transport(target.endpoint, envelope(event, time));
      return true;
    },
  };
};
