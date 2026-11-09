# Data layer (ARC-06)

Server data goes through one cache, TanStack Query v5 (`src/common/data`). Redux keeps only
the live state that comes over the socket (devices, positions, events) and the session.

## Reading

- Fleet database: `useFleetQuery(table, parts, build, { enabled, reloadKey })` from
  `src/common/data/fleetQuery.js`. `build(client)` returns a PostgREST query; the request is
  cancelled (`abortSignal`) when no screen needs it any more, so an old answer never overwrites a
  newer one. Keys are `['fleet', orgId, table, ...parts]`: data of one organization never
  shows in another.
- Shared hooks built on it: `useFleetRows`, `useFleetVehicles`, `useFleetDrivers`
  (`src/fleet/stage5Data.js`), `useVehicleIndex`, `useVendors` (`src/fleet/fleetData.js`) and
  `useExpiries` (one `documents_expiring` request for every screen that shows validity dates).
- Traccar REST: `useTraccarQuery(path)`, keys `['traccar', path]`.

Defaults (`src/common/data/queryClient.js`): fresh for 30 seconds, kept 5 minutes, retried twice
on network and server errors (never on 4xx or a database rule), fetched again when the network
comes back.

## Writing

Every successful write to the fleet database marks the cached reads of that table stale, on
every screen (`writtenTables` in `src/common/fleet/client.js`); a function that writes
(`fleet_save`, `billing_save_invoice`, ...) marks every fleet read stale. Screens that still keep a
`reloadKey` keep working: a new key fetches again. `useInvalidateFleet()(table)` does it by hand.

Signing out clears the cache.

## Moving a screen over

Replace `useState` + `useAsyncTask` + `getFleetClient()` with `useFleetQuery`, drop the
`reloadKey` once the screen's writes go through the fleet client, and keep the query key
parts to what changes the result (filters, ids).
