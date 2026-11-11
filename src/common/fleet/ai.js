// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { fleetConfig } from './config';
import { getFleetClient, unwrap } from './client';
import { getFreshFleetAccessToken } from './session';

// The browser side of the fleet-ai edge function (AI-01, AI-03, AI-04). The model key never
// reaches the browser; every call carries the user's fleet token and is counted against the
// organization's daily limit.

export class AiRequestError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AiRequestError';
    this.code = code;
  }
}

// The translation key for an AI error, for the message the user reads.
export const aiErrorKey = (error) =>
  ({
    ai_disabled: 'aiErrorDisabled',
    daily_limit: 'aiErrorLimit',
    not_configured: 'aiErrorNotConfigured',
    refused: 'aiErrorRefused',
    busy: 'aiErrorBusy',
  })[error?.code] || 'aiErrorGeneral';

export const aiRequest = async (route, body, { signal } = {}) => {
  const token = await getFreshFleetAccessToken();
  let response;
  try {
    response = await fetch(`${fleetConfig.url}/functions/v1/fleet-ai/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: fleetConfig.anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AiRequestError('network');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AiRequestError(
      result?.error?.code || `http_${response.status}`,
      result?.error?.message,
    );
  }
  return result;
};

export const loadAiStatus = async () => unwrap(await getFleetClient().rpc('ai_status')) || null;

// AI-03: fault codes, from the shared library when known, otherwise through the model (which
// adds them to the library). `useModel` false reads the library only.
export const explainCodes = async (codes, { useModel = true } = {}) => {
  const wanted = [...new Set(codes.map((code) => String(code).trim().toUpperCase()))].filter(
    (code) => /^[PBCU][0-9A-F]{4}$/.test(code),
  );
  if (!wanted.length) return [];
  const known =
    unwrap(await getFleetClient().from('dtc_library').select('*').in('code', wanted)) || [];
  const found = new Map(known.map((row) => [row.code, row]));
  if (useModel && wanted.some((code) => !found.has(code))) {
    const { items } = await aiRequest('dtc', { codes: wanted });
    items.forEach((item) => !item.unknown && found.set(item.code, item));
  }
  return wanted.map((code) => found.get(code) || { code, unknown: true });
};

// How many other vehicles report the same code now.
export const vehiclesWithCode = (positions, code, exceptDeviceId) =>
  Object.values(positions).filter(
    (position) =>
      position.deviceId !== exceptDeviceId &&
      String([position.attributes?.dtcs, position.attributes?.faults].filter(Boolean).join(','))
        .toUpperCase()
        .split(/[\s,;]+/)
        .includes(code),
  ).length;
