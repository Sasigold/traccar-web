#!/usr/bin/env sh
# Private source maps for the error service (FND-06). A build with VITE_ERROR_DSN makes hidden
# source maps (no link from the scripts). They must never be served, so:
#
#   sh deploy/sourcemaps.sh split     move build/**/*.map into sourcemaps/ (CI does this before it
#                                     keeps build/ as the site; deploy.sh also skips *.map)
#   sh deploy/sourcemaps.sh upload    put them back next to the scripts, in a copy, and upload them
#                                     to Sentry or GlitchTip for the release in build/version.json
#
# upload uses sentry-cli, which works with both services, and reads SENTRY_URL (e.g.
# https://glitchtip.example.com or https://sentry.io), SENTRY_ORG, SENTRY_PROJECT and
# SENTRY_AUTH_TOKEN from the environment. In CI the token is a secret of that job only.
set -eu
cd "$(dirname "$0")/.."

case "${1:-}" in
  split)
    mkdir -p sourcemaps
    (cd build && find . -name '*.map' -exec sh -c '
      for file; do
        mkdir -p "../sourcemaps/$(dirname "$file")"
        mv "$file" "../sourcemaps/$file"
      done' sh {} +)
    echo "Source maps moved out of build/: $(find sourcemaps -name '*.map' | wc -l | tr -d ' ')"
    ;;

  upload)
    for name in SENTRY_URL SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN; do
      eval "value=\${$name:-}"
      [ -n "$value" ] || { echo "$name is not set."; exit 1; }
    done
    release=$(sed -n 's/.*"release": *"\([^"]*\)".*/\1/p' build/version.json)
    [ -n "$release" ] || { echo "build/version.json is missing."; exit 1; }
    work=$(mktemp -d)
    cp -R build/. "$work/"
    cp -R sourcemaps/. "$work/"
    cli="npx --yes @sentry/cli@2"
    $cli releases new "$release"
    # The scripts are served from the site root (base './'), so "~/" matches any host.
    $cli sourcemaps upload --release "$release" --url-prefix '~/' "$work"
    $cli releases finalize "$release"
    rm -rf "$work"
    echo "Source maps uploaded for $release."
    ;;

  *)
    echo "Usage: sh deploy/sourcemaps.sh split|upload"
    exit 1
    ;;
esac
