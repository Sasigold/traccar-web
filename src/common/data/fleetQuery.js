import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFleetClient, unwrap } from '../fleet/client';
import fetchOrThrow from '../util/fetchOrThrow';
import store, { messagesActions } from '../../store';
import { translate } from '../util/translator';
import { readAll } from './paging';

// ARC-06: queries of the fleet database through one cache. Keys start with the organization
// (['fleet', orgId, table, ...]), so data of one organization is never shown in another
// (ARC-04), and `invalidateFleet(table)` refreshes every screen that shows that table.
export const fleetKey = (orgId, table, ...parts) => ['fleet', orgId ?? null, table, ...parts];

export const useFleetOrg = () => useSelector((state) => state.fleet.profile?.org_id ?? null);

// The message when a list stops at the ceiling (ARC-08).
const notifyTruncated = (table, count) =>
  store.dispatch(
    messagesActions.push({
      message: translate('sharedListTruncated').replace('{0}', count.toLocaleString()),
      severity: 'warning',
    }),
  );

export const readAllRows = (table, build, signal) => readAll(table, build, signal, notifyTruncated);

// `build(client)` returns a PostgREST query builder; the request is cancelled with the screen.
// With `paged`, every page is read (ARC-08) instead of PostgREST's first 1,000 rows.
export const useFleetQuery = (
  table,
  parts,
  build,
  { enabled = true, reloadKey = 0, paged = false } = {},
) => {
  const orgId = useFleetOrg();
  const query = useQuery({
    queryKey: fleetKey(orgId, table, ...parts),
    queryFn: async ({ signal }) =>
      paged
        ? readAllRows(table, () => build(getFleetClient()), signal)
        : unwrap(await build(getFleetClient()).abortSignal(signal)),
    enabled: Boolean(enabled && orgId),
  });
  // Screens that still count reloads (reloadKey) get a fresh fetch on each change.
  const { refetch } = query;
  useEffect(() => {
    if (reloadKey) refetch();
  }, [reloadKey, refetch]);
  return query;
};

export const useInvalidateFleet = () => {
  const queryClient = useQueryClient();
  const orgId = useFleetOrg();
  return (table) =>
    queryClient.invalidateQueries({
      queryKey: table ? fleetKey(orgId, table) : ['fleet', orgId ?? null],
    });
};

// Traccar REST: ['traccar', path].
export const useTraccarQuery = (path, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['traccar', path],
    queryFn: async ({ signal }) => (await fetchOrThrow(path, { signal })).json(),
    enabled,
  });
