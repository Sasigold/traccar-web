import { decodeDashboardValue, encodeDashboardValue } from './codec';
import { normalizeDashboard } from './schema';

// REP-19: a dashboard shared as a link (/dashboard?import=…). The link carries the layout and
// settings only, never data; whoever opens it gets a copy of their own, over their own vehicles.
const toBase64Url = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

export const shareParam = (dashboard) =>
  toBase64Url(JSON.stringify(encodeDashboardValue(normalizeDashboard(dashboard))));

export const readShareParam = (value) => {
  if (!value) return null;
  try {
    return normalizeDashboard(decodeDashboardValue(JSON.parse(fromBase64Url(value))));
  } catch {
    return null;
  }
};

export const shareUrl = (dashboard, origin = window.location.origin) =>
  `${origin}/dashboard?import=${shareParam(dashboard)}`;
