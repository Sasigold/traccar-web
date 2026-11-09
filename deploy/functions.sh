#!/usr/bin/env sh
# Deploy the edge functions kept in this repository (public-api, INT-01; billing-documents,
# BIZ-01) to the VPS.
# Run `sh deploy/migrate.sh` first: the function needs the api_* database functions.
#
#   sh deploy/functions.sh            copy, restart the functions container, check the answer
#   sh deploy/functions.sh rollback   put back the copy from before the last deploy
#
# Each function goes to $FLEET_DIR/volumes/functions/<name>/; the copy it replaces is kept next to
# it as <name>.prev. Tests are not copied. Nothing secret is in these folders: the container
# provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
set -eu

HOST="${DEPLOY_HOST:-root@72.61.153.60}"
FLEET_DIR="${FLEET_DIR:-/docker/viper-fleet}"
FLEET_URL="${FLEET_URL:-https://viper-fleet-api.srv2122641.hstgr.cloud}"
FUNCTIONS="public-api billing-documents fleet-ai"

cd "$(dirname "$0")/..
. deploy/lib.sh
remote() { ssh -o ConnectTimeout=30 "$HOST" "$@"; }

TARGET="$FLEET_DIR/volumes/functions"

for name in $FUNCTIONS; do
  if [ "${1:-}" = "rollback" ]; then
    echo "Rolling back $name"
    remote "test -d '$TARGET/$name.prev' && rm -rf '$TARGET/$name' && mv '$TARGET/$name.prev' '$TARGET/$name'"
  else
    echo "Deploying $name"
    remote "rm -rf '$TARGET/$name.next' && mkdir -p '$TARGET/$name.next'"
    tar cf - --exclude='__tests__' -C "supabase/functions/$name" . | remote "tar xf - -C '$TARGET/$name.next'"
    remote "rm -rf '$TARGET/$name.prev'; if [ -d '$TARGET/$name' ]; then mv '$TARGET/$name' '$TARGET/$name.prev'; fi; mv '$TARGET/$name.next' '$TARGET/$name'"
  fi
done

# The edge runtime keeps workers warm; a restart makes it load the new code.
RUNTIME=$(remote "docker ps --format '{{.Names}} {{.Image}}'" | pick_container '^supabase/edge-runtime(:|@|$)' "${RUNTIME_CONTAINER:-}" || true)
if [ -n "$RUNTIME" ]; then
  echo "Restarting $RUNTIME"
  remote "docker restart '$RUNTIME'" >/dev/null
  sleep 5
else
  echo "No single supabase/edge-runtime container (set RUNTIME_CONTAINER); restart it by hand."
fi

echo "Checking $FLEET_URL/functions/v1/public-api/v1"
if curl -fsS "$FLEET_URL/functions/v1/public-api/v1" | grep -q '"resources"'; then
  echo "public-api answers."
else
  echo "public-api did not answer as expected. Roll back with: sh deploy/functions.sh rollback"
  exit 1
fi
