# Staging (FND-04)

Production used to be the only environment: `npm start`, every pull request build, the demo and the
demo-data script all talked to the real fleet database and the real Traccar. Now:

| | Fleet database | Traccar | How it gets there |
|---|---|---|---|
| `npm start` | `.env.development.local` (copy `.env.example`); none by default | `localhost:8082` | by hand |
| `npm run demo`, e2e | `https://fleet.demo.invalid` (never resolves; tests mock it) | built-in mock server | - |
| CI build | `https://fleet.ci.invalid` | - | every pull request |
| staging | `STAGING_FLEET_URL` | the staging Traccar | every push to `main` (`deploy.yml`) |
| production | the production database | `traccar-ovjj` | "Promote to production" (`promote.yml`), by hand |

A production or staging build stops when it does not name its fleet database, and a staging build
stops when it names the production one (`src/common/fleet/buildEnv.js`). Staging and development
show a "סביבת בדיקות" / "סביבת פיתוח" badge in the top bar. `deploy/demo-data.mjs` refuses the
production Traccar unless `--allow-production` is given.

## Setting staging up on the VPS

Nothing here has been run yet; it needs SSH access to the server. Same server, separate everything:

1. **Traccar.** A second Traccar container next to `/docker/traccar-ovjj`, for example in
   `/docker/traccar-staging`, with its own database (a copy of `traccar.xml` pointing at a new
   database or a new H2 folder), its own ports (web 8083, device ports shifted or closed) and its own
   subdomain in the reverse proxy. Mount `./web` like production (see
   `docker-compose.override.example.yml`).
2. **Fleet database.** A second self-hosted Supabase stack, for example in
   `/docker/viper-fleet-staging`, from the same docker folder as production but with **new** secrets:
   a new JWT secret and newly generated anon and service-role keys (never production's), its own
   Kong port and its own subdomain. Load the base schema (`supabase/base/` after
   `deploy/snapshot-backend.sh`), then run the migrations with
   `DB_CONTAINER=<staging db container> FLEET_DIR=/docker/viper-fleet-staging sh deploy/migrate.sh`.
   Copy the `traccar-auth` function and point it at the staging Traccar.
3. **Name the containers.** With two stacks, `migrate.sh`, `functions.sh`, `snapshot-backend.sh` and
   `backup.sh` refuse to guess which database or edge runtime to use: set `DB_CONTAINER` /
   `RUNTIME_CONTAINER` (and `TRACCAR_DB_CONTAINER` for `backup.sh`). The nightly backup of production
   needs `DB_CONTAINER` in its cron line from then on.
4. **GitHub.** Create the `staging` environment and the repository variables listed at the top of
   `.github/workflows/deploy.yml` (`STAGING_WEB_DIR`, `STAGING_SITE_URL`, `STAGING_FLEET_URL`,
   `STAGING_FLEET_ANON_KEY`, `STAGING_FLEET_DIR`, `STAGING_DB_CONTAINER`,
   `STAGING_RUNTIME_CONTAINER`), plus `PRODUCTION_DB_CONTAINER` and `PRODUCTION_RUNTIME_CONTAINER`.
   Add required reviewers to the `production` environment.
5. **Demo data** goes to staging only:
   `node deploy/demo-data.mjs run --url https://<staging traccar> --email … --password …`.
   If demo vehicles were seeded into production earlier, remove them there with
   `node deploy/demo-data.mjs clean --url https://<site> --allow-production …`
   (it deletes only what the script created).

## Releases and rollback (FND-05)

Every build knows its release, `1.0.0+<commit>` (`package.json` version plus the commit): Preferences
shows it and `version.json` next to `index.html` serves it. A deploy never deletes before the new page
is in place: the new files are copied in beside the old ones, then `index.html`, `version.json` and
`sw.js` are swapped by rename, and only files that none of the last five releases has are removed.
Tabs opened before a deploy keep loading their chunks; one that misses a file reloads once
(`src/common/util/staleBuild.js`). After the deploy, `deploy/smoke.sh` checks that the new release is
served and that a script of its page downloads.

- `sh deploy/deploy.sh releases` lists the kept releases and the current one.
- `sh deploy/deploy.sh rollback` puts the previous one back (or `rollback <release>`), in seconds,
  without a build. The "Roll back" workflow does the same from GitHub, for production or staging.
- The database is not rolled back: migrations only add, and an older UI works with the newer schema.

## Deploying by hand

`sh deploy/deploy.sh` builds before it uploads, so it needs the build's fleet database:

```sh
VITE_FLEET_URL=https://<fleet-api> VITE_FLEET_ANON_KEY=<anon key> sh deploy/deploy.sh
```

or put both in `.env.production.local` (git ignores it). For staging:
`npm run build -- --mode staging` with the staging values, then
`SKIP_BUILD=1 DEPLOY_DIR=<staging web dir> sh deploy/deploy.sh`.
