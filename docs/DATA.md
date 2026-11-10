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

## Types (ARC-11)

- `src/common/fleet/database.d.ts` is the fleet database's contract (tables, views, enums and
  functions), generated from the migrations: `sh tools/db-types.sh` (with `PGHOST`, `PGPORT`,
  `PGUSER` for a local Postgres; it runs `supabase/tests/run.sh` first). Commit it with every
  migration; CI fails when it is stale. Tables that live only on the server come from the
  stand-in in `supabase/tests/base_standin.sql`.
- `getFleetClient()` is typed with it, so `from('table')` knows the columns in checked files.
- `npm run typecheck` (also in CI) runs `tsc` over the JavaScript (`tsconfig.json`, not strict).
  Files that do not pass yet start with `// @ts-nocheck`; remove that line when you fix one.
  New code is checked by default and may be written in TypeScript. Row types:
  `/** @type {import('../common/fleet/database').Tables<'incidents'>} */`.
