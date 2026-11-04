#!/usr/bin/env sh
# Apply supabase/migrations/*.sql to the Viper Fleet database on the VPS.
# Each file runs once; applied files are recorded in vf_meta.ui_migrations.
# The database container is found by its image (supabase/postgres).
set -eu

HOST="${DEPLOY_HOST:-root@72.61.153.60}"

cd "$(dirname "$0")/.."

remote() { ssh -o ConnectTimeout=30 "$HOST" "$@"; }

DB=$(remote "docker ps --format '{{.Names}} {{.Image}}'" | awk '$2 ~ /^supabase\/postgres/ { print $1; exit }')
if [ -z "$DB" ]; then
  echo "No running supabase/postgres container on $HOST"
  exit 1
fi
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

applied=0
for file in supabase/migrations/*.sql; do
  name=$(basename "$file")
  if [ "$(psql_remote -tA -c "\"select 1 from vf_meta.ui_migrations where name = '$name'\"")" = 1 ]; then
    echo "Already applied: $name"
    continue
  fi
  echo "Applying: $name"
  { cat "$file"; printf "\ninsert into vf_meta.ui_migrations (name) values ('%s');\n" "$name"; } | psql_remote
  applied=$((applied + 1))
done

if [ "$applied" -gt 0 ]; then
  # PostgREST only sees new tables after a schema reload.
  echo "notify pgrst, 'reload schema';" | psql_remote
fi
echo "Migrations done ($applied applied)."
