#!/usr/bin/env sh
# Build the custom UI and deploy it to the Traccar container on the VPS (FND-05).
#
#   sh deploy/deploy.sh             build (unless SKIP_BUILD=1) and deploy
#   sh deploy/deploy.sh rollback    put the previous release back (or: rollback <release>)
#   sh deploy/deploy.sh releases    list the kept releases
#
# The compose file bind-mounts DEPLOY_DIR at /opt/traccar/web, so Traccar itself serves this build
# (same origin, websocket, cookies). Replacing that folder would detach the mount, so files change
# in place, in an order that never breaks an open tab:
#   1. the release is uploaded next to the site, into DEPLOY_DIR.releases/<time>-<release>/
#   2. its new files are copied in beside the old ones; nothing is deleted yet
#   3. index.html, then version.json, then sw.js are swapped by rename (atomic). index.html first:
#      the new service worker must find the new page when it caches it
#   4. files that no kept release has are removed; the last KEEP_RELEASES releases stay, so tabs
#      opened on them still load their chunks, and rollback is instant
# DEPLOY_HOST=local runs the server side on this machine (for testing the script).
set -eu

HOST="${DEPLOY_HOST:-root@72.61.153.60}"
REMOTE_DIR="${DEPLOY_DIR:-/docker/traccar-ovjj/web}"
KEEP="${KEEP_RELEASES:-5}"

cd "$(dirname "$0")/.."

remote() {
  if [ "$HOST" = local ]; then
    sh -c "$1"
  else
    ssh -o ConnectTimeout=30 "$HOST" "$1"
  fi
}

# The server side: activate release $1 from $RELEASES into $WEB, then prune.
server_script() {
  cat <<EOF
set -eu
export LC_ALL=C
WEB='$REMOTE_DIR'
RELEASES='$REMOTE_DIR.releases'
KEEP='$KEEP'
release="\$1"
src="\$RELEASES/\$release"
[ -n "\$WEB" ] && [ -f "\$src/index.html" ] || { echo "No release \$release"; exit 1; }
mkdir -p "\$WEB"
(cd "\$src" && tar cf - --exclude=./index.html --exclude=./version.json --exclude=./sw.js .) | (cd "\$WEB" && tar xf -)
for file in index.html version.json sw.js; do
  if [ -f "\$src/\$file" ]; then
    cp "\$src/\$file" "\$WEB/.\$file.next"
    mv -f "\$WEB/.\$file.next" "\$WEB/\$file"
  fi
done
printf '%s\n' "\$release" > "\$RELEASES/CURRENT"
# A failed upload leaves a .partial folder; it is never a release.
rm -rf "\$RELEASES"/*.partial
# Keep the newest KEEP releases and the current one; drop older ones.
cd "\$RELEASES"
ls -1d */ 2>/dev/null | sed 's#/\$##' | sort -r | awk -v keep="\$KEEP" -v current="\$release" \
  'NR > keep && \$0 != current' | while read -r old; do rm -rf "\$RELEASES/\$old"; done
# Remove site files that no kept release has (old chunks of releases that are gone).
keep_list=\$(mktemp)
have_list=\$(mktemp)
for dir in */; do (cd "\$dir" && find . -type f); done | sort -u > "\$keep_list"
(cd "\$WEB" && find . -type f ! -name '.*.next') | sort > "\$have_list"
comm -23 "\$have_list" "\$keep_list" | while read -r gone; do rm -f "\$WEB/\$gone"; done
rm -f "\$keep_list" "\$have_list"
echo "Active: \$release"
EOF
}

releases_dir="$REMOTE_DIR.releases"

case "${1:-deploy}" in
  releases)
    remote "cd '$releases_dir' && ls -1d */ | sed 's#/\$##' | sort -r; echo; echo current: \$(cat CURRENT 2>/dev/null)"
    ;;

  rollback)
    target="${2:-}"
    if [ -z "$target" ]; then
      target=$(remote "cd '$releases_dir' && current=\$(cat CURRENT) && ls -1d */ | sed 's#/\$##' | sort -r | awk -v c=\"\$current\" 'found { print; exit } \$0 == c { found = 1 }'")
    fi
    [ -n "$target" ] || { echo "No earlier release to roll back to."; exit 1; }
    # The name goes into a command on the server: release folder names only.
    case "$target" in
      *[!A-Za-z0-9.+_-]*) echo "Not a release name: $target"; exit 1 ;;
    esac
    echo "Rolling back to $target"
    remote "sh -s -- '$target' <<'SERVER'
$(server_script)
SERVER"
    ;;

  deploy)
    # SKIP_BUILD=1 reuses an existing build/ (used by CI to retry only the upload).
    [ "${SKIP_BUILD:-0}" = 1 ] || npm run build
    release=$(sed -n 's/.*"release": *"\([^"]*\)".*/\1/p' build/version.json)
    [ -n "$release" ] || { echo "build/version.json is missing; build again."; exit 1; }
    name="$(date -u +%Y%m%dT%H%M%SZ)-$release"
    echo "Uploading $release to $HOST:$releases_dir/$name"
    tar czf - -C build . | remote "set -e; mkdir -p '$releases_dir/$name.partial'; tar xzf - -C '$releases_dir/$name.partial'; mv '$releases_dir/$name.partial' '$releases_dir/$name'"
    remote "sh -s -- '$name' <<'SERVER'
$(server_script)
SERVER"
    echo "Deployed $release."
    ;;

  *)
    echo "Usage: sh deploy/deploy.sh [deploy|rollback [release]|releases]"
    exit 1
    ;;
esac
