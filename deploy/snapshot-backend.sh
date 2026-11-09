#!/usr/bin/env sh
# Copy the parts of the backend that live only on the VPS into this repository, so they are
# reviewed, versioned and can be rebuilt after a disk failure (review item FND-03):
#   supabase/base/schema.sql              schema of the fleet database (no data)
#   supabase/base/migrations/             the base migrations from /docker/viper-fleet/migrations
#   supabase/functions/traccar-auth/      the edge function that mints the fleet JWT
# Run from a machine with SSH access to the VPS, review the diff, then commit.
set -eu

HOST="${DEPLOY_HOST:-root@72.61.153.60}"
FLEET_DIR="${FLEET_DIR:-/docker/viper-fleet}"

cd "$(dirname "$0")/.."
. deploy/lib.sh
remote() { ssh -o ConnectTimeout=30 "$HOST" "$@"; }

DB=$(remote "docker ps --format '{{.Names}} {{.Image}}'" | pick_container '^supabase/postgres(:|@|$)' "${DB_CONTAINER:-}") || {
  echo "Set DB_CONTAINER to the production database on $HOST."
  exit 1
}

mkdir -p supabase/base/migrations supabase/functions/traccar-auth

echo "Schema of public, vf_meta and storage policies -> supabase/base/schema.sql"
remote "docker exec $DB pg_dump -U postgres -d postgres --schema-only --no-owner --no-privileges \
  --schema=public --schema=vf_meta" > supabase/base/schema.sql
remote "docker exec $DB psql -X -At -U postgres -d postgres -c \
  \"select format('create policy %I on storage.objects for %s using (%s)%s;', policyname, cmd, qual, \
     coalesce(' with check (' || with_check || ')', '')) from pg_policies where schemaname = 'storage'\"" \
  > supabase/base/storage_policies.sql

echo "Base migrations -> supabase/base/migrations/"
remote "cd '$FLEET_DIR/migrations' && tar cf - ." | tar xf - -C supabase/base/migrations

echo "Edge function -> supabase/functions/traccar-auth/"
remote "cd '$FLEET_DIR/volumes/functions/traccar-auth' && tar cf - ." | tar xf - -C supabase/functions/traccar-auth

echo "Done. Check that no secret was copied (grep for keys and passwords), then commit."
