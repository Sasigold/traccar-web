import { ApiError, endpointOf, parseErrorBody } from './apiError';

// Long enough for big reports, short enough that a dead connection does not spin forever.
const TIMEOUT_MS = 120000;

export const UNAUTHORIZED_EVENT = 'vf:unauthorized';

const withTimeout = (signal) => {
  if (typeof AbortSignal === 'undefined' || !AbortSignal.timeout) {
    return { signal };
  }
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  if (!signal) {
    return { signal: timeout, timeout };
  }
  return AbortSignal.any ? { signal: AbortSignal.any([signal, timeout]), timeout } : { signal };
};

export default async (input, init = {}) => {
  const endpoint = endpointOf(input);
  const { signal, timeout } = withTimeout(init.signal);
  let response;
  try {
    response = await fetch(input, { ...init, signal });
  } catch (error) {
    // Cancelled by the caller (page left, newer request): not an error to show.
    if (init.signal?.aborted) {
      throw error;
    }
    if (timeout?.aborted) {
      throw new ApiError({ kind: 'timeout', endpoint });
    }
    throw new ApiError({ kind: 'network', endpoint, detail: error.message });
  }
  if (!response.ok) {
    const { code, detail } = parseErrorBody(await response.text());
    // The session may have expired: the app checks it and returns to the login screen.
    if (response.status === 401 && !endpoint.startsWith('api/session')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError({ status: response.status, code, endpoint, detail });
  }
  return response;
};
