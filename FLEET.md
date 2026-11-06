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
`assignments.write`, `documents.read/write`, `reports.read`, `audit.read`, and for the super admin area `customers.read/manage`, `billing.read/manage`.

## Super admin area (`/admin`)

A separate area for Traccar administrators (shield item in the navigation rail; the route redirects
everyone else). Traccar still owns users and devices; the fleet database adds customers, the device
registry and billing.

| Page | What it does |
|------|--------------|
| `/admin` | KPIs (devices, online, customers, devices without a customer, users, monthly recurring revenue, open and overdue balance), devices waiting for a customer, silent devices, overdue bills |
| `/admin/customers`, `/admin/customer/:id` | Customers with tabs: details, devices (assign / unassign, billable switch), users (link an existing Traccar user, create a new one, sync access), billing (plan, price overrides, discount, cycle, payment terms, the customer's bills) |
| `/admin/devices` | Every device (`api/devices?all=true`) with its customer, status, model and SIM; filter by customer / status; bulk assign to a customer |
| `/admin/device/:id`, `/admin/device` | Device setup in five steps: device (name, IMEI, model with the server port hint), SIM, customer and installation, vehicle (speed limit in km/h, odometer), sensors |
| `/admin/users` | Every user with its customer and role; assign to a customer, log in as, disable / enable |
| `/admin/billing` | Bills with filters and Excel export; monthly generation for all active subscriptions; draft → issued → paid / cancelled |
| `/admin/plans` | Price lists (per device per month, base fee, setup fee, cycle) |

**Ownership.** Assigning a device to a customer writes `device_registry.customer_id` and links the device
(`api/permissions`) to every Traccar user of that customer, removing the links of the previous customer's
users. Linking a user to a customer links all of the customer's devices to it. "Sync access" re-creates
all links of a customer.

**Sensors** (`src/admin/sensors.js`, unit-tested). A person picks what is wired and to which input, and
sees the live value from the latest position next to each sensor. The choices are written as:

- the `web.vehicle` display profile (`sensors` list, parameter labels, fuel source, scale for raw fuel
  calibrated from empty / full readings, tire display) that the telemetry dashboard already reads, plus
  `fuelCapacity` and `speedLimit` (knots) device attributes;
- Traccar computed attributes for wired inputs: `ignition ← inN`, `door ← inN`, `alarm = inN ? "sos" : null`.
  They carry a `[vf:<deviceId>]` description prefix, are linked to that device only, and are created,
  updated or removed to match the sensor list on every save.

**Billing** (`src/admin/billing.js`, unit-tested). Monthly amount = (base fee + price per device × billable
devices) × (1 − discount). Quarterly and yearly cycles bill calendar quarters / years. Bills are payment
requests for internal tracking, not tax invoices. Totals and VAT (default 18%) are recomputed by the
database from the lines, and a customer can be billed only once per period (cancelled bills excepted).

**Database.** `supabase/migrations/20261104120000_super_admin.sql` adds `customers`, `customer_users`,
`device_registry`, `device_assignment_history`, `billing_plans`, `billing_subscriptions`,
`billing_invoices`, `billing_invoice_lines`, the views `billing_invoices_view` and
`customer_device_counts`, RLS policies and the permission keys `customers.read`, `customers.manage`,
`billing.read`, `billing.manage` (granted to `owner` and `admin`, `customers.read` to `manager`).
`20261104130000_super_admin_permissions.sql` registers those keys in the permission catalog that
`role_permissions.permission` references (found through the foreign key) and then grants them. Both are
idempotent. The deploy workflow applies every file in `supabase/migrations/` once
(`deploy/migrate.sh`: finds the `supabase/postgres` container over SSH, records applied files in
`vf_meta.ui_migrations`, reloads the PostgREST schema). To run it by hand: `sh deploy/migrate.sh`.
After the first run press "Reconnect" in the admin area (or log in again) so the new permissions reach
the session.

Without the migration, or with the fleet database disabled, the device, sensor and user pages still work;
the customer and billing parts show why they are unavailable.

## Roadmap stage 0: fleet details in Traccar attributes

Stage 0 of the roadmap works without the fleet database. Structured vehicle and driver details are stored
in the Traccar `attributes` JSON; the keys are defined once in `src/common/fleet/fleetFields.js` and stage
1 migrates them into the `vehicles` / `drivers` tables. Dates are `YYYY-MM-DD` strings.

| Entity | Keys |
|--------|------|
| Vehicle (device) | `plateNumber`, `vin`, `make`, `vehicleModel`, `modelYear`, `fuelType`, `ownership`, `fleetNotes`; dates `testExpiry`, `insuranceCompulsoryExpiry`, `insuranceComprehensiveExpiry`, `leaseEndDate` |
| Driver | `nationalId`, `phone`, `email`, `hireDate`, `driverStatus`, `licenseNumber`, `licenseClasses` (array), `fleetNotes`; date `licenseExpiry` |

- **Validity** (`/fleet/expiries`): every date above, soonest first, "needs attention" = expired or within
  30 days. The map shows a one-line summary above the vehicle list; `/fleet` shows tiles. Drivers marked
  `ended` are left out.
- **Maintenance status** (`/settings/maintenances`, "status by vehicle", and the vehicle page): computed
  from the latest position (`src/common/fleet/maintenanceStatus.js`). `start` is read as the last service:
  next = `start` while the value is below it, otherwise `start + period`; due soon = within 10% of the
  period. "Mark as done" sets `start` to the current value (it applies to every vehicle linked to that
  maintenance, and the dialog says so).
- **Fault codes**: `dtcs` / `faults` position attributes appear as chips on the map status card.
- **Navigation**: a top-level "Fleet" item (`/fleet`) covers vehicles, drivers, maintenance and validity.
