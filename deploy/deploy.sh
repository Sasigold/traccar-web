#!/usr/bin/env sh
# Build the custom UI and push it to the Traccar container on the VPS.
# The compose file bind-mounts /docker/traccar-ovjj/web at /opt/traccar/web,
# so Traccar itself serves this build (same origin, websocket, cookies).
# Files are synced IN PLACE: replacing the directory would detach the bind mount.
set -eu

HOST="${DEPLOY_HOST:-root@72.61.153.60}"
REMOTE_DIR="${DEPLOY_DIR:-/docker/traccar-ovjj/web}"

cd "$(dirname "$0")/.."
npm run build

echo "Uploading build/ to $HOST:$REMOTE_DIR"
tar czf - -C build . | ssh "$HOST" "set -e; mkdir -p '$REMOTE_DIR' '$REMOTE_DIR.new'; tar xzf - -C '$REMOTE_DIR.new'; \
  rsync -a --delete '$REMOTE_DIR.new/' '$REMOTE_DIR/'; rm -rf '$REMOTE_DIR.new'"
echo "Deployed."
