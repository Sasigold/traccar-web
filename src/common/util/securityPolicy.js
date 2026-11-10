// The browser security policy of the app (SEC-10). Pure: used by vite.config.js, which puts the
// Content-Security-Policy in index.html at build time, and by deploy/security-headers, the
// reverse-proxy configuration with the headers a <meta> tag cannot carry.
//
// Why it is not stricter:
//   connect-src / img-src https:  map tiles, glyphs and sprites come from the map providers a
//                                 server is configured with (useMapStyles), and custom ones
//   style-src 'unsafe-inline'     Emotion (MUI) writes its styles at run time
//   'wasm-unsafe-eval'            the QR scanner decodes with WebAssembly (zxing-wasm)
//   worker-src blob:              MapLibre and hls.js start their workers from blob URLs
// Scripts, the part that matters against XSS, are 'self' plus the hashes of the inline scripts
// in index.html: an injected <script> or inline handler does not run.

import { createHash } from 'node:crypto';

export const scriptHash = (source) =>
  `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;

// The contents of the inline <script> elements of an HTML page (no src attribute).
export const inlineScripts = (html) =>
  [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);

export const contentSecurityPolicy = ({ scriptHashes = [], header = false } = {}) =>
  [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    // Only a response header can say these (a <meta> policy ignores them).
    ...(header ? ["frame-ancestors 'none'", 'upgrade-insecure-requests'] : []),
  ].join('; ');

// Every header the reverse proxy should send with the app (deploy/security-headers).
export const securityHeaders = ({ scriptHashes = [] } = {}) => ({
  'Content-Security-Policy': contentSecurityPolicy({ scriptHashes, header: true }),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // The origin only, never the path: share and tracking links carry their token in the path.
  // (no-referrer would break map tile providers that require a Referer, such as OpenStreetMap.)
  'Referrer-Policy': 'strict-origin',
  'Permissions-Policy':
    'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
});
