#!/usr/bin/env sh
# After a deploy (FND-05): is the new release really served, and do its files load?
#
#   sh deploy/smoke.sh <site-url> [expected-release]
#
# Checks the page shell, version.json (the release, when given) and that one of the scripts the
# page names downloads. A page whose scripts 404 is exactly what a broken deploy looks like, and the
# shell alone would not show it.
set -eu

SITE="${1:?site url}"
EXPECTED="${2:-}"
SITE="${SITE%/}"
get() { curl -fsS --max-time 30 -H 'Cache-Control: no-cache' "$@"; }

page=$(get "$SITE/")
printf '%s' "$page" | grep -q '<div id="root"' || { echo "The page shell is missing."; exit 1; }

served=$(get "$SITE/version.json?check=$(date +%s)" | sed -n 's/.*"release": *"\([^"]*\)".*/\1/p')
[ -n "$served" ] || { echo "version.json is missing or has no release."; exit 1; }
if [ -n "$EXPECTED" ] && [ "$served" != "$EXPECTED" ]; then
  echo "Serving $served, expected $EXPECTED."
  exit 1
fi

script=$(printf '%s' "$page" | grep -o 'src="[^"]*assets/[^"]*\.js"' | head -n 1 | sed 's/^src="//; s/"$//; s#^\./##')
[ -n "$script" ] || { echo "The page names no script."; exit 1; }
status=$(curl -s -o /dev/null -w '%{http_code} %{size_download}' --max-time 30 "$SITE/$script")
case "$status" in
  "200 0") echo "$script is empty."; exit 1 ;;
  200\ *) ;;
  *) echo "$script answers HTTP ${status%% *}."; exit 1 ;;
esac

echo "Serving $served; $script loads (${status#* } bytes)."
