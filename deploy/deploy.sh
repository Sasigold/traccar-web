#!/usr/bin/env sh
# Build the custom UI and push it to the Traccar container on the VPS.
# The compose file mounts /docker/traccar-ovjj/web into /opt/traccar/web,
# so Traccar itself serves this build (same origin, websocket, placeholders).
set -eu

HOST="${DEPLOY_HOST:-root@72.61.153.60}"
REMOTE_DIR="${DEPLOY_DIR:-/docker/traccar-ovjj/web}"

cd "$(dirname "$0")/.."
npm run build

echo "Uploading build/ to $HOST:$REMOTE_DIR"
tar czf - -C build . | ssh "$HOST" "mkdir -p '$REMOTE_DIR.new' && tar xzf - -C '$REMOTE_DIR.new' \
  && rm -rf '$REMOTE_DIR.old' && { [ -d '$REMOTE_DIR' ] && mv '$REMOTE_DIR' '$REMOTE_DIR.old' || true; } \
  && mv '$REMOTE_DIR.new' '$REMOTE_DIR' && rm -rf '$REMOTE_DIR.old'"
echo "Deployed."
