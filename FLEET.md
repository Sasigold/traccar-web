# Viper Fleet database integration

The UI talks to two backends:

| Backend | What it holds | Auth |
|---------|---------------|------|
| Traccar (same origin, `api/...`) | devices, positions, events, users, drivers | Traccar session cookie |
| Viper Fleet Supabase (`https://viper-fleet-api.srv2122641.hstgr.cloud`) | vehicle/driver documents, fleet roles & permissions, audit log | JWT minted from the Traccar login |

Traccar is the only identity provider. After login, `src/FleetController.jsx` asks Traccar for a
short-lived session token (`POST api/session/token`), posts it to the `traccar-auth` edge function on the
Supabase host, and gets back a 12-hour Supabase JWT plus the user's fleet profile and permissions. The
function verifies the token against Traccar inside the VPS docker network and creates the profile on first
login (Traccar administrators become fleet `admin`, the very first user becomes `owner`).

## Code map

- `src/common/fleet/config.js` - URL, anon key (public, RLS-restricted), bucket name. Override with
  `VITE_FLEET_URL` / `VITE_FLEET_ANON_KEY`; an empty `VITE_FLEET_URL` disables the integration.
- `src/common/fleet/session.js` - token bridge + localStorage cache (`fleetSession`).
- `src/common/fleet/client.js` - the shared `supabase-js` client (`getFleetClient()`), `unwrap()` helper.
- `src/common/fleet/useFleet.js` - hooks: `useFleetReady`, `useFleetPermission(key)`, `useFleetProfile`,
  `useFleetLabel` (Hebrew/English document type labels), expiry helpers.
- `src/store/fleet.js` - connection state (`idle | loading | ready | error | disabled`).
- `src/settings/components/FleetDocumentsSection.jsx` - documents card on the device and driver pages.
- `src/settings/FleetDocumentsPage.jsx` - `/settings/fleet-documents`, all documents by expiry.
- `src/settings/components/FleetRoleSection.jsx` - fleet role + permissions card on the user page.

## Data model (server side)

Schema and migrations live on the VPS in `/docker/viper-fleet/migrations/`; the edge function in
`/docker/viper-fleet/volumes/functions/traccar-auth/index.ts`. Rows link to Traccar by
`vehicles.traccar_device_id`, `drivers.traccar_driver_id`, `profiles.traccar_user_id`. Storage paths are
`<org_id>/vehicles/<vehicle_id>/<file>` or `<org_id>/drivers/<driver_id>/<file>` in the private
`documents` bucket. Row Level Security decides everything through `has_permission('<key>')`.

Permission keys: `users.read`, `users.manage`, `vehicles.read/write`, `drivers.read/write`,
`assignments.write`, `documents.read/write`, `reports.read`, `audit.read`.
