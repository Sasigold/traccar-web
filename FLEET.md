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

## Dashboard (`/dashboard`)

A personal, customizable dashboard: the second item in the navigation rail (on phones it opens from
the menu drawer and the command palette). Code in `src/dashboard/`; the pure parts (no React) have unit
tests in `__tests__` folders next to them.

**Layout without gaps** (`layout/`). A dashboard is a list of rows. A row has a height in units
(40px plus the gap) and 1–6 cells whose widths always add up to 12 columns. A cell holds 1–3 widgets
stacked on top of each other whose heights always add up to the row height. Every operation in
`layout/operations.js` (add, remove, move beside / stacked / to a new row / swap, resize a divider, width
and height presets, own row, duplicate) keeps both sums exact, so the grid never has a hole: enlarging a
widget shrinks its neighbours, and cells that no longer fit move to a new row right below.
`normalize.js` repairs any saved layout, and a property test applies thousands of random edits and checks
the invariants after each one. `responsive.js` adapts the saved layout to the screen without changing it:
under 960px rows that would get too narrow wrap into extra lines that are still full, and under 600px
every widget gets its own line (KPI tiles pair up). Rows are CSS grids, so the layout follows the page
direction (the first widget is on the right in Hebrew).

**Editing.** "Customize" opens edit mode on a draft with undo / redo (Ctrl+Z / Ctrl+Shift+Z); "Done"
saves and "Cancel" drops the draft. On wide screens with a mouse: drag a widget by its handle onto the
edge of another (side = next to it, top / bottom = stacked, between rows = a new row, middle = swap),
and drag the dividers between widgets and under rows; the rest reflows live with a short animation.
Every action is also in the widget menu (size presets, move earlier / later, own row, duplicate, remove)
and the dividers work with the arrow keys, which is how phones and keyboard users edit.

**Widgets** (`widgets/catalog.js`). 33 presets in three groups, plus a custom chart:

| Group | Data | Examples |
|-------|------|----------|
| Live fleet | Redux store (devices, positions, events) | fleet now KPIs, moving-now hero, connection status, motion (moving / idling / parked / offline), speed, fuel, last report, composition, by group, live map (one per dashboard), latest events |
| Activity for the period | Traccar `api/reports/summary` (`daily=true` for days, trips for hours), `trips`, `stops`, `events` | activity KPIs with change against the previous period, distance over time, by vehicle / driver, engine hours, fuel, trips by hour and weekday, idling, events by type, speeding, vehicle summary table |
| Maintenance, costs, validity | `useExpiries()` (works without the database), Traccar maintenance, fleet database views and tables | validity, maintenance due, fleet management KPIs, costs by type / month / vehicle, work orders, damage by severity, driver safety |

Each chart widget is a query: dataset × measure × dimension (×"split by"), defined in
`data/datasets.js`. The settings dialog changes any part of it and shows a live preview; the form
switcher in the widget header offers every form that fits the data (`widgets/vizRules.js`): KPI, meter,
donut, pie, split bar, bars, columns, stacked columns, line, area and table. Every chart also has a
table view and Excel export. Clicking a part of a live chart lists the vehicles behind it.

**Data** (`data/`). One filter row scopes every widget: period (today … last month, custom, with
previous / next), vehicle groups (subgroups included) and auto refresh. Report requests always send
explicit vehicle ids, in chunks of 100 with at most three requests at a time, are shared between widgets
through one cache (`queryCache.js`) and are refused above a size limit (the widget asks for a shorter
period or a group). While data reloads the previous chart stays on screen, faded. Fleet-database widgets
need the matching permission (`costs.read`, `maintenance.read`, `incidents.read`, `safety.read`); when
the database is not connected they show why instead of data.

**Colors** come from `dataviz` in `src/common/theme/tokens.js` (exposed as `theme.palette.dataviz`):
existing brand token values only, ordered with a color-blind safety validator. Status-like values
(online / offline, expired / expiring, overdue / due) use the status colors with a label; single-series
charts use one hue (navy in light mode, aqua in dark mode).

**Saving** (`model/`). The dashboards are a compact JSON string in the user attribute
`web.dashboard` (at most 3000 characters; the whole attributes column holds about 4000), saved 1.2 s
after the last change and merged into the latest user object. A copy is always kept in localStorage
(`dashboard:<userId>`), which is all that read-only users and the demo get. An administrator can publish
the current dashboard as the organization default (server attribute `web.dashboardDefault`); users
without a dashboard of their own start from it, and "Reset" returns to it. Built-in templates:
Operations (the default), Activity, and Maintenance & costs. Both attributes are hidden from the raw
attribute editors.

**Adding a preset**: add an entry to `PRESETS` in `widgets/catalog.js` (a chart preset is a query plus a
default form and size), add `dashboardW<Id>` and `dashboardW<Id>Desc` to both `he.json` and `en.json`,
and run `npm test`; the catalog test checks the query, the form and the strings.

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
(`deploy/migrate.sh`: finds the `supabase/postgres` container over SSH, takes a full `pg_dump -Fc`
backup into `/root/vf-backups/` (last 10 kept) before the first pending file, records applied files in
`vf_meta.ui_migrations`, reloads the PostgREST schema). The deploy job only runs after CI passes and
uses the `production` GitHub Environment, so required reviewers there approve every production
migration. To run it by hand: `sh deploy/migrate.sh`. `vf_meta.ui_migrations` is the source of truth
for what is applied.
After the first run press "Reconnect" in the admin area (or log in again) so the new permissions reach
the session.

Without the migration, or with the fleet database disabled, the device, sensor and user pages still work;
the customer and billing parts show why they are unavailable.

## Security model and database tests

- **Platform administrators.** Customers, the device registry and billing have no `org_id`; only users in
  `public.platform_admins` hold `customers.*` / `billing.*`, whatever their organization role or overrides
  say (`has_permission()` answers those keys with `is_platform_admin()`,
  `20261109120000_security_hardening.sql`). The migration seeds the active owners and admins that are not
  users of a customer. To add someone (as an existing platform admin, or as `postgres`):
  `insert into public.platform_admins (user_id) select id from public.profiles where traccar_user_id = <id>;`
  Nobody can remove themselves.
- **Drivers** reach incident parties, claims, photos and checklist answers only through incidents and
  inspections they may see. They upload files but never replace or delete them.
- **Tests.** `supabase/tests/run.sh` applies every migration to a fresh Postgres on top of
  `supabase/tests/base_standin.sql` (a stand-in for the VPS-only base schema) and runs
  `supabase/tests/*.test.sql`. CI runs it on every pull request. Locally:
  `PGHOST=... PGPORT=... PGUSER=postgres sh supabase/tests/run.sh`.

## Backups and the backend in git

- **Nightly backups** run on the VPS with `deploy/backup.sh` (install steps at the top of the file): the fleet
  database (`pg_dump -Fc` plus roles), the fleet storage files, the Traccar database or data folder and
  `traccar.xml`, kept 14 days, and copied off the server when `OFFSITE` names an rclone remote.
  Restore the fleet database:
  `docker exec -i <db> pg_restore -U postgres -d postgres --clean --if-exists < fleet.dump`.
  Practise a restore into a scratch container once a quarter.
- **Before every migration** `deploy/migrate.sh` also dumps the database into `/root/vf-backups/`.
- **Backend source.** `deploy/snapshot-backend.sh` copies the base schema, the base migrations and the
  `traccar-auth` edge function from the VPS into `supabase/base/` and `supabase/functions/`; run it from a
  machine with SSH access, check that no secret was copied, and commit. Until that is done the token bridge
  and the base tables exist only on the VPS disk.

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

## Roadmap stage 1: cards saved to the fleet database

`supabase/migrations/20261106120000_fleet_stage1.sql` (applied) adds the vehicle / driver detail columns,
`alert_recipients`, `document_alerts`, `notification_deliveries`, `vehicle_fuel_cards` and the daily
`vf_document_alerts` pg_cron job (04:00 UTC, thresholds 60/30/14/7/0). Alerts are queued for WhatsApp
recipients; nothing is sent until a sender with provider keys exists.

- **Saving** a vehicle or driver card writes Traccar first, then the `vehicles` / `drivers` row
  (`src/fleet/fleetRecords.js`, mapping in `src/common/fleet/fleetSync.js`, unit-tested). Validity dates
  become documents without a file (test, compulsory / comprehensive insurance, lease, driving license):
  a missing one is added, a file-less one has its date moved, one with a scanned file is kept and a new
  one is added. Clearing a date never deletes a document. A database error is shown and saving again
  retries; the Traccar save is not undone.
- **Opening** a card lays the database values over the Traccar attributes (the database wins).
- **Validity page** merges `documents_expiring` with the card dates and keeps only the latest date per
  vehicle / driver and type, so a renewed document doesn't leave an expired one behind.
- **Copy to the database** (card on `/fleet`, needs `vehicles.write` or `drivers.write`) copies every card
  with stage 0 details; it only fills values, never clears what the database already has.

## Sending alerts (WhatsApp, SMS, email)

`supabase/migrations/20261110130000_messaging.sql`. Expiry alerts (and later other kinds) are queued in
`notification_deliveries` for every active recipient; every minute `messaging_dispatch()` sends what is due
through pg_net and `messaging_collect()` reads the answers.

- **Set up** in Service management → Sending channels (`/admin/messaging`, platform admins): the provider,
  the sender and the key of each channel, then a test message. Keys go to Supabase Vault
  (`messaging_<channel>`) through `messaging_set_secret` and are never readable through the API.
  - WhatsApp: Meta WhatsApp Business Platform. Sender = the phone number id; key = a permanent access
    token; template = an approved Hebrew **utility** template whose body has one parameter (`{{1}}`) that
    receives the message text, e.g. "תזכורת מ-viper fleet: {{1}}".
  - SMS: Vonage (key `api_key:api_secret`, sender = name or number).
  - Email: Resend (key = API key, sender = `viper fleet <alerts@your-domain>`; the domain must be verified).
  - Any channel can instead post JSON (`channel`, `to`, `subject`, `text`, `kind`, `id`) to a webhook with a
    bearer token, for another SMS gateway or an automation (Make, Zapier).
- **Rules**: numbers are sent as international digits (0501234567 → 972501234567); opted-out addresses
  (`messaging_optouts`) are skipped; a failure retries after 1, 2, 4 and 8 minutes and is marked failed after
  5 attempts; each message keeps its status, the provider's message id and the last error (shown in the
  delivery log on the expiry alerts page). Alerts are not marketing; `alert_recipients.marketing_consent`
  is there for marketing messages, which need prior consent (Communications Law, section 30A).
- **Not yet**: delivery and read receipts (provider webhooks), replies and two-way conversations with
  drivers.

## Government vehicle registry (data.gov.il)

The Ministry of Transport's open registry (`private-and-commercial-vehicles`, no key, CORS open) is read
straight from the browser (`src/common/fleet/govRegistry.js`; resource ids from `package_show`, the known
ids as a fallback).

- **Vehicle card**: "מילוי מהמאגר הממשלתי" next to the details looks the plate up and shows what would
  change (make, model, year, VIN, fuel, ownership, test expiry) before filling the card. Nothing is saved
  until the card is.
- **Validity page**: "עדכון תוקף טסט מהמאגר" checks every vehicle with a plate and moves its test expiry
  to the registry's `tokef_dt`, saved like a card save (Traccar, then the database).
- **Every night** (`supabase/migrations/20261110120000_gov_registry_sync.sql`): at 01:30 UTC
  `gov_registry_request()` asks the registry about every vehicle with a plate (pg_net, one request per
  resource); at 02:00 UTC `gov_registry_apply()` applies the answers before the 04:00 document alerts. The
  latest `vehicle_test` document takes the registry date: a document without a file has its date moved, a
  scanned one is kept and a new one is added. `gov_registry_requests` records each lookup's outcome
  (`updated`, `unchanged`, `not_found`, `error`) for 14 days. Without pg_net nothing is scheduled (the
  migration says so) and the validity page button does the same job.

## Traffic and parking tickets (transfer to the driver)

A ticket on a company vehicle has to be transferred to the driver (or paid) by a deadline, usually 90 days
from the notice; after it the company is charged an increased fine, usually four times the amount.
`src/common/fleet/violations.js` holds the rules (`transferDeadline`, `violationUrgency`,
`companyPenalty`, `violationsByDriver`, `transferLetter`), unit-tested.

- **Ticket form** (`/fleet/safety` → "עבירות ודוחות", new or the pencil on a row): the receipt date fills
  the deadline (+90 days, editable); a warning shows the date and the company fine while the ticket is open
  or assigned; "who drove?" finds the driver from the track; "charge the driver" records a payroll
  deduction or collection and its date.
- **Countdown**: each open ticket shows the days left (warning from 14 days, red when overdue).
- **Transfer letter**: "מכתב הסבה" opens a printable notice to the issuer with the driver's name, ID and
  licence number from the driver's file, the plate and the company name, and a line for the driver to sign.
  Missing details print as blank lines to fill in.
- **Tickets by driver**: count, still open, fines, points and fines still to charge, per driver.

Columns `received_at`, `charge_driver`, `charged_at` on `driver_violations`
(`supabase/migrations/20261110140000_violation_transfer.sql`).

## Roadmap stages 2-4

All fleet database screens live under `/fleet` (code in `src/fleet/`, pure logic with unit tests in
`src/common/fleet/`). Files go to the private `fleet-files` bucket as `<org_id>/<area>/...`; the area
(`work-orders`, `incidents`, `inspections`, `expenses`, `safety`) picks the storage permission
(`fleet_file_permission()`).

| Screen | What | Permission |
|--------|------|------------|
| `/fleet/alerts` | Open expiry alerts ("handled"), recipients (WhatsApp alerts, email reports), outbox | `alerts.read` / `alerts.manage` |
| `/fleet/work-orders`, `/fleet/work-order`, `/fleet/vendors` | Work orders with lines (database total), invoice, closing resets the Traccar maintenance counter | `maintenance.*` |
| `/fleet/inspections`, `/fleet/inspection` | Checklist templates, filling in (failed item opens an issue), open issues | `inspections.*`, issues `maintenance.*` |
| `/fleet/incidents`, `/fleet/incident` | Damage / accidents: location and driver from the track, photos, parties, insurance claim | `incidents.*` |
| `/fleet/costs` | Cost per vehicle, fuel company import (CSV / Excel, anomaly flags, re-import safe), expenses | `costs.*` |
| `/fleet/roles`, `/fleet/users` | Role matrix per organization, users (role, active, last seen, exceptions) | `roles.manage`, `users.*` |
| `/fleet/safety`, `/fleet/driver-file/:id` | Driver score, driving / rest hours, license checks, trainings, violations ("who drove?"), printable driver file | `safety.*` |
| `/driver` | Driver portal (role `driver`): my vehicle, morning check, damage report, my documents | `inspections.write`, `incidents.write` |

**Permissions.** `has_permission()` reads, in order: the user's exception (`user_permissions`), owner (all),
the organization's role setting (`org_role_permissions`), the global role default (`role_permissions`).
The owner role can't be edited and admin can't lose `roles.manage`. Changing a role on `/fleet/users`
also sets the Traccar user flags (read only / device read only / limited commands) to match.

**Drivers.** A user with the `driver` role sees only the vehicle assigned to them
(`vehicle_driver_assignments`, set on the driver page) and only their own inspections and incidents.
Link the driver to the user on the driver page ("linked user"). In Traccar the driver's user also needs a
link to the vehicle (connections) to see it live.

**Safety numbers are parameters.** Score weights and driving / rest limits are stored per organization in
`org_safety_settings` and edited on `/fleet/safety`; the defaults in `src/common/fleet/safety.js` must be
confirmed by a certified transport safety officer before relying on them.

**Waiting for provider keys.** Alerts are queued in `notification_deliveries` with status `queued`;
nothing is sent until a WhatsApp / email sender is added. User invitations by email / WhatsApp wait for
the same.

Migrations: `20261106130000_fleet_stage2.sql`, `20261106140000_fleet_stage3.sql`,
`20261106150000_fleet_stage4.sql` (the last adds the `safety_officer` role value before its transaction).
Each was checked against the database in a rolled-back transaction before commit.

## Roadmap stage 5: expansions

`supabase/migrations/20261106160000_fleet_stage5.sql` (idempotent; tested on a local Postgres with
stand-ins for the earlier schema; applied to the VPS database by the deploy of 2026-11-06). Pure logic with unit tests:
`src/common/fleet/dispatch.js`, `visits.js`, `sensors.js`, `integrations.js`.

| Screen | What | Permission |
|--------|------|------------|
| `/fleet/dispatch` | Jobs (delivery, pickup, service, visit) with point / address, vehicle, driver, time window; live ETA from the vehicle's position; customer tracking link (a Traccar share link that expires an hour after the window) with a ready WhatsApp message | `dispatch.read` / `dispatch.write` |
| `/driver` → "My jobs today" | The driver moves a job along: on the way → arrived → done (receiver name and / or photo) or not done; navigation in Waze | `dispatch.read` (role `driver`) |
| `/fleet/poi` | Points of interest (customer, depot, supplier, fuel, garage) with a Traccar circle geofence; "visits" pairs `geofenceEnter` / `geofenceExit` events into arrivals, departures and minutes | `poi.read` / `poi.write` |
| `/fleet/equipment` | Trailers and equipment without a tracker: a `vehicles` row with `asset_kind` = `trailer` / `equipment`, no `traccar_device_id`, optionally `attached_vehicle_id` | `vehicles.read` / `vehicles.write` |
| `/fleet/sensors` | EV battery (`batteryLevel`, `charge`) and cold chain temperatures (`temp`, `temp1`, ...) live from the latest positions, against per-vehicle limits (`temp_min`, `temp_max`, `battery_min`) | live data for everyone; limits `vehicles.write` |
| `/fleet/integrations` | API keys (shown once, stored as SHA-256), webhooks (HTTPS, events per table), delivery log | `integrations.manage` |

**Dispatch rules in the database.** Status timestamps (`started_at`, `arrived_at`, `completed_at`) are
set by a trigger; a job with a vehicle or driver moves from `planned` to `assigned`. A driver reads only
their own jobs and may only set `en_route`, `arrived`, `done` or `failed`. Proof photos go to
`fleet-files/<org_id>/dispatch/...`.

**Webhooks.** Triggers on `dispatch_jobs`, `incidents`, `work_orders`, `issues`, `inspections`,
`document_alerts` and `driver_violations` queue a delivery per matching webhook in `webhook_deliveries`.
Event names are `<table>.insert`, `<table>.status` (status changed), `<table>.update` or `<table>.*`.
The `vf_send_webhooks` pg_cron job (every minute) posts them with `pg_net`, signs the body in
`X-ViperFleet-Signature: sha256=<HMAC-SHA256(body, secret)>`, and retries with exponential back-off up to
5 attempts. Without the `pg_net` extension deliveries stay `queued`.

**API keys.** `api_key_lookup(key)` (service role only) returns the organization and scopes of a valid
key. The public API gateway that calls it (an edge function on the VPS, next to `traccar-auth`) is not in
this repository yet; until it exists keys can be created and revoked but not used. The screen says so.

**Left out on purpose.**
- *Per-customer branding (white label).* BRAND.md forbids changing, recoloring or replacing the viper fleet
  logo and palette, so this needs a brand decision before any code.
- *Accounting, payroll and fuel company APIs.* Each needs a chosen provider and its keys; until then the
  Excel exports and webhooks are the integration points.
- *Documents for trailers and equipment.* The documents card is still tied to a Traccar device.
