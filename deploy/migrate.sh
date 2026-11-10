#!/usr/bin/env sh
# Apply supabase/migrations/*.sql to the Viper Fleet database on the VPS.
# Each file runs once; applied files are recorded in vf_meta.ui_migrations.
# Before the first pending file runs, the whole database is dumped (pg_dump -Fc) on the VPS.
# Restore: docker exec -i <db> pg_restore -U postgres -d postgres --clean < <file>.dump
# The database container is found by its image (supabase/postgres).
set -eu

# SEC-21: no address in the repository; set DEPLOY_HOST=user@address (or use ~/.ssh/config).
HOST="${DEPLOY_HOST:?Set DEPLOY_HOST=user@address of the VPS}"

cd "$(dirname "$0")/.."
. deploy/lib.sh

remote() { ssh -o ConnectTimeout=30 "$HOST" "$@"; }

# Exactly the supabase/postgres image (not supabase/postgres-meta and friends). With a staging
# stack on the same server, DB_CONTAINER names the database (FND-04).
DB=$(remote "docker ps --format '{{.Names}} {{.Image}}'" | pick_container '^supabase/postgres(:|@|$)' "${DB_CONTAINER:-}") || {
  echo "Set DB_CONTAINER to the database of this environment on $HOST."
  exit 1
}
echo "Database container: $DB"

psql_remote() { remote "docker exec -i $DB psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres $*"; }

psql_remote <<'SQL'
create schema if not exists vf_meta;
create table if not exists vf_meta.ui_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
revoke all on schema vf_meta from public;
SQL

# One round trip for the ledger instead of one per file.
done_list=$(psql_remote -tA -c "\"select name from vf_meta.ui_migrations\"")
pending=""
for file in supabase/migrations/*.sql; do
  name=$(basename "$file")
  if printf '%s\n' "$done_list" | grep -qxF "$name"; then
    echo "Already applied: $name"
  else
    pending="$pending $file"
  fi
done

applied=0
if [ -n "$pending" ]; then
  # Full backup before touching the schema; the last 10 are kept on the server.
  BACKUP_DIR="${BACKUP_DIR:-/root/vf-backups}"
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  echo "Backing up the database to $BACKUP_DIR/pre-migration-$stamp.dump"
  remote "set -e; mkdir -p '$BACKUP_DIR'; chmod 700 '$BACKUP_DIR'; \
    docker exec $DB pg_dump -U postgres -d postgres -Fc > '$BACKUP_DIR/pre-migration-$stamp.dump'; \
    test -s '$BACKUP_DIR/pre-migration-$stamp.dump'; \
    ls -1t '$BACKUP_DIR'/pre-migration-*.dump | tail -n +11 | xargs -r rm -f"

  for file in $pending; do
    name=$(basename "$file")
    echo "Applying: $name"
    { cat "$file"; printf "\ninsert into vf_meta.ui_migrations (name) values ('%s');\n" "$name"; } | psql_remote
    applied=$((applied + 1))
  done
fi

if [ "$applied" -gt 0 ]; then
  # PostgREST only sees new tables after a schema reload.
  echo "notify pgrst, 'reload schema';" | psql_remote
fi
echo "Migrations done ($applied applied)."
