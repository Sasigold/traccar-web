#!/usr/bin/env sh
# Prints the security headers of the current build (SEC-10) for the reverse proxy in front of
# Traccar, from build/security-headers.json (written by every build).
#
#   sh deploy/security-headers.sh nginx      add_header lines for the server/location block
#   sh deploy/security-headers.sh caddy      a header block for the site
#   sh deploy/security-headers.sh traefik    labels for the traccar service (docker compose)
#
# The Content-Security-Policy carries the hash of the inline script in index.html: print the
# headers again after a build that changes that script. deploy/SECURITY-HEADERS.md explains.
set -eu
cd "$(dirname "$0")/.."
file=build/security-headers.json
[ -f "$file" ] || { echo "No $file: build first (npm run build)."; exit 1; }
format="${1:-nginx}"
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const headers = JSON.parse(readFileSync('$file', 'utf8'));
const entries = Object.entries(headers);
const quote = (value) => value.replace(/\"/g, '\\\\\"');
switch ('$format') {
  case 'nginx':
    entries.forEach(([name, value]) => console.log('add_header ' + name + ' \"' + quote(value) + '\" always;'));
    break;
  case 'caddy':
    console.log('header {');
    entries.forEach(([name, value]) => console.log('  ' + name + ' \"' + quote(value) + '\"'));
    console.log('}');
    break;
  case 'traefik':
    console.log('labels:');
    entries.forEach(([name, value]) =>
      console.log('  - \"traefik.http.middlewares.vf-security.headers.customresponseheaders.' + name + '=' + value.replace(/\\\$/g, '\$\$') + '\"'));
    console.log('  # and add vf-security to the router: traefik.http.routers.<router>.middlewares=vf-security');
    break;
  default:
    console.error('Usage: sh deploy/security-headers.sh nginx|caddy|traefik');
    process.exit(1);
}
"
