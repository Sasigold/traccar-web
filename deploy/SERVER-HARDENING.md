# Server hardening (SEC-11, SEC-19)

What only the server can fix. Nothing here can be done from the repository: this environment has no
SSH access to the VPS. Each step says how to check it afterwards.

## 1. Traccar's web port only behind HTTPS (SEC-11)

Traccar answers plain HTTP on port 8082. Anything sent there (the login password, the session
cookie, the Basic auth of scripts, API tokens) crosses the internet unencrypted.

1. Publish 8082 on the loopback address only. In `/docker/traccar-ovjj/docker-compose.yml`
   (service `traccar`):

   ```yaml
   ports:
     - "127.0.0.1:8082:8082"   # was "8082:8082": only the reverse proxy on this machine reaches it
   ```

   If the proxy is Traefik on the same Docker network, drop the 8082 mapping altogether: Traefik
   reaches the container by its network name.
2. `docker compose up -d traccar`.
3. Check from your own computer (not from the server):
   `sh deploy/check-exposure.sh <vps-address> https://<site>`.
   Every internal port must say `closed`, and `http://` must redirect to `https://`.
   (From a cloud session behind a proxy this check is not reliable: the proxy may refuse the
   ports itself.)

`deploy/demo-data.mjs` now refuses a non-HTTPS address (except `http://localhost`, on the server).

## 2. Device ports (SEC-11)

Ports 5001 to 5200 receive positions. A device is known only by its identifier, so anyone who knows
an IMEI can send false positions for it. Ways to narrow it, from the simplest:

- Open only the protocols in use: with Teltonika (5027) and OsmAnd (5055) only, close the rest in
  the firewall (`ufw allow 5027/tcp`, `ufw allow 5055/tcp`, default deny).
- Restrict a port to the mobile operators' address ranges where the devices' SIMs connect from
  (ask the SIM provider for the APN's public ranges; private APNs make this exact).
- In Traccar: `filter.enable=true` with `filter.invalid`, `filter.zero`, `filter.distance` and
  `filter.maxSpeed` drops impossible jumps, and `server.registration=false` keeps unknown devices
  out (no auto-registration).

## 3. Demo data on staging only (SEC-11)

`deploy/demo-data.mjs` refuses the production server unless given `--allow-production` (FND-04).
To remove old demo vehicles from production once:
`node deploy/demo-data.mjs clean --url https://<site> --allow-production`.

## 4. Checklist (SEC-19)

Check each item on the server, write the result in the table with the date, and commit this file.

| # | What | How to check | Expected | Result |
|---|---|---|---|---|
| 1 | Traccar `web.origin` | `traccar.xml` | the site address, e.g. `https://<site>` (without it some versions answer CORS for any origin with credentials) | |
| 2 | Session cookie flags | browser DevTools → the `JSESSIONID` cookie | `Secure`, `HttpOnly`, `SameSite=Lax` or `Strict` (`web.sameSiteCookie`) | |
| 3 | Two-factor for administrators | `traccar.xml`: `server.totpForce` / user attribute | on for administrators | |
| 4 | Traccar self-registration | Settings → Server → "Registration" | off | |
| 5 | Supabase sign-up | `.env` of the Supabase stack: `DISABLE_SIGNUP` | `true` (users come only from `traccar-auth`) | |
| 6 | Supabase Studio password | `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` in `.env` | not the defaults (`supabase` / `this_password_is_insecure...`) | |
| 7 | Studio exposure | `sh deploy/check-exposure.sh` | port 3000 closed; Studio only through an SSH tunnel | |
| 8 | Postgres exposure | `sh deploy/check-exposure.sh` | port 5432 closed | |
| 9 | Supabase JWT secret and keys | `.env`: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` | not the example values from the Supabase docker folder | |
| 10 | Service-role key | where it is stored | only in the edge runtime's environment and GitHub secrets, never in the app | |
| 11 | SSH | `/etc/ssh/sshd_config` | `PasswordAuthentication no`; root by key only (better: a deploy user, SEC-21) | |
| 12 | Firewall | `ufw status` | default deny incoming; 22, 80, 443 and the device ports in use | |
| 13 | Updates | `apt list --upgradable`, Traccar and Supabase image versions | current security updates | |
| 14 | Backups | `deploy/backup.sh` in cron, a copy off the server | last night's backup exists and restores | |

Date of the last check: ____ · by: ____

## Server details stay out of the repository (SEC-21)

The scripts and workflows no longer carry the server's address, its host key or a root login.

1. In GitHub, Settings → Secrets and variables → Actions → **Variables**, add:
   - `DEPLOY_HOST`: `user@address` of the VPS. Prefer a deploy user over `root` (a user in the
     `docker` group that owns the web and fleet directories).
   - `VPS_HOST_KEY`: the line printed by `ssh-keyscan -t ed25519 <address>`.
   - `PRODUCTION_SITE_URL` and `PRODUCTION_FLEET_URL`: the app's and the fleet API's addresses.
2. On your own machine, set `DEPLOY_HOST` (and `FLEET_URL` for `deploy/functions.sh`) before
   running the scripts, or add a `Host vf` entry in `~/.ssh/config` and use `DEPLOY_HOST=vf`.
3. Keep the repository private. The address is still in the git history; rewriting history is
   optional, since the hardening above (firewall, key-only SSH) is what protects the server.
