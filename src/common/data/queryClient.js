import { QueryClient } from '@tanstack/react-query';

// ARC-06: one cache for data from Traccar's REST API and from the fleet database. Redux keeps
// only the live state from the socket. Queries are cancelled when no screen needs them, retried
// twice on network and server errors (never on 4xx: those will not change), and fetched again
// when the network comes back.
export const shouldRetry = (count, error) => {
  const status = Number(error?.status ?? error?.response?.status);
  if (status >= 400 && status < 500) return false;
  // PostgREST errors carry a code: a permission or a constraint is not a network blip.
  if (error?.code && /^(42|23|22|PGRST)/.test(String(error.code))) return false;
  return count < 2;
};

export const createQueryClient = (options = {}) =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: shouldRetry,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        ...options,
      },
    },
  });

const queryClient = createQueryClient();

export default queryClient;
