#!/usr/bin/env sh
# What the server exposes to the internet (SEC-11, SEC-19). Run from any machine OUTSIDE the
# server (a laptop, or a CI job): it only connects, it sends no credentials.
#
#   sh deploy/check-exposure.sh <public-ip> [https-site]
#
# Fails when a port that should be internal answers from outside: Traccar's web port 8082 (plain
# HTTP: passwords and tokens in clear), Postgres 5432, the Supabase API gateway 8000/8443 and
# Studio 3000. The device ports (5001-5200) are expected to be open; see
# deploy/SERVER-HARDENING.md for limiting them. With an HTTPS site, also checks that plain
# http:// redirects to https://.
set -u
IP="${1:?public ip}"
SITE="${2:-}"
bad=0
probe() {
  # curl exit 7 = refused, 28 = timeout (filtered): both mean closed from here.
  curl -s -o /dev/null --connect-timeout 5 --max-time 8 "http://$IP:$1/"
  code=$?
  if [ "$code" -eq 7 ] || [ "$code" -eq 28 ]; then
    echo "closed  $1 ($2)"
  else
    echo "OPEN    $1 ($2)"
    bad=1
  fi
}
probe 8082 "Traccar web over plain HTTP"
probe 5432 "Postgres"
probe 8000 "Supabase API gateway"
probe 8443 "Supabase API gateway (TLS)"
probe 3000 "Supabase Studio"
if [ -n "$SITE" ]; then
  host=$(printf '%s' "$SITE" | sed 's#^https\?://##; s#/.*##')
  location=$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 10 "http://$host/")
  case "$location" in
    https://*) echo "ok      http://$host redirects to HTTPS" ;;
    *) echo "WARN    http://$host does not redirect to HTTPS"; bad=1 ;;
  esac
fi
[ "$bad" -eq 0 ] && echo "Nothing internal answers from outside." || echo "Close the ports marked OPEN: deploy/SERVER-HARDENING.md."
exit "$bad"
