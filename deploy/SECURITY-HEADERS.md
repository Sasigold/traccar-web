# Security headers (SEC-10)

Traccar's own web server (Jetty) sends the app without security headers. Two layers fix that.

## 1. In the app, already on (no server change)

Every build puts a Content-Security-Policy in `index.html` as a `<meta>` tag
(`vite.config.js`, policy in `src/common/util/securityPolicy.js`). Scripts run only from the app
itself and the one inline script, by its hash: an injected `<script>` or `onclick=` does not run,
which is what protects the Bearer token in the browser from XSS. A `<meta name="referrer"
content="strict-origin">` sends other sites the origin only, never a path (share and tracking links
carry their token in the path).

Checked on a production build of the demo: map, replay, reports, dashboard, settings, vehicle,
telemetry, fleet and service management load with no violation.

## 2. At the reverse proxy (owner action)

A `<meta>` tag cannot carry `frame-ancestors` (clickjacking), HSTS, `nosniff`, `X-Frame-Options`
or `Permissions-Policy`. Add them where HTTPS ends for the Traccar site:

```sh
npm run build                          # or download the build artifact of the deploy
sh deploy/security-headers.sh traefik  # or: nginx | caddy
```

and paste the output into the proxy configuration (Traefik: the labels of the `traccar` service in
the compose file, and `vf-security` in the router's middlewares; nginx: inside the `server` block;
Caddy: inside the site block). The values come from `build/security-headers.json`, written by every
build. The Content-Security-Policy there names the hash of the inline script in `index.html`:
print it again whenever that script changes (the unit test `securityPolicy.test.js` keeps it to one
inline script and no inline handlers).

After the next deploy, `deploy/smoke.sh` warns while any of the headers is missing.

| Header | Value | Why |
|---|---|---|
| Content-Security-Policy | as in the app, plus `frame-ancestors 'none'` and `upgrade-insecure-requests` | XSS and clickjacking |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | HTTPS only, also on the next visit |
| X-Content-Type-Options | `nosniff` | uploaded files are not run as scripts |
| X-Frame-Options | `DENY` | clickjacking, for older browsers |
| Referrer-Policy | `strict-origin` | no paths or tokens to other sites |
| Permissions-Policy | camera and location for the app only; no microphone, payment or USB | the QR scanner and incident location need them |
| Cross-Origin-Opener-Policy | `same-origin` | other windows cannot reach this one |

## Why the policy is not stricter, and how to tighten it

- `connect-src` and `img-src` allow `https:`: map tiles, glyphs and sprites come from the map
  providers configured on the server (and custom map addresses). With a fixed set of providers,
  replace `https:` with them, for example `https://*.tile.openstreetmap.org` and the fleet database
  address, in the proxy header (the stricter of the two policies wins).
- `style-src 'unsafe-inline'`: MUI writes its styles at run time.
- `'wasm-unsafe-eval'`: the QR scanner (vehicle setup) decodes with WebAssembly, which it downloads
  from `fastly.jsdelivr.net`. Hosting that file ourselves would remove the third party.
- `web.customHead` in Traccar (`<!--${customHead}-->` in `index.html`): an inline script added
  there is blocked unless its hash is added to `script-src`.

Some share links may be meant to sit inside another site (an iframe on a customer's page). If so,
set `frame-ancestors` for that path only, to the customer's address.
