import { pascalCase } from '../util/stringUtils';
// Organization API keys and webhooks (pure, tested).

export const API_SCOPES = ['read', 'write'];

// Webhook event names match the database trigger: <table>.<insert|update|status> or <table>.*.
export const WEBHOOK_SOURCES = [
  'dispatch_jobs',
  'incidents',
  'work_orders',
  'issues',
  'inspections',
  'document_alerts',
  'driver_violations',
];
export const WEBHOOK_ACTIONS = ['insert', 'status', 'update'];

export const webhookEventKey = (source) => `fleetWebhookSource${pascalCase(source)}`;

const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

// vf_<40 hex>; the prefix (first 8 characters) is kept to recognise the key in the list.
export const generateApiKey = (random = (bytes) => crypto.getRandomValues(bytes)) => {
  const key = `vf_${toHex(random(new Uint8Array(20)))}`;
  return { key, prefix: key.slice(0, 8) };
};

export const sha256Hex = async (text) =>
  toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));

export const isValidWebhookUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

export const keyState = (key, now = new Date()) => {
  if (key.revoked_at) {
    return 'revoked';
  }
  if (key.expires_at && new Date(key.expires_at) <= now) {
    return 'expired';
  }
  return 'active';
};
