#!/usr/bin/env sh
# ARC-11: regenerate src/common/fleet/database.d.ts from every migration, on a fresh local
# database (supabase/tests/run.sh makes it). Usage: PGHOST=... PGPORT=... PGUSER=postgres
# sh tools/db-types.sh [--check]. With --check, fails when the committed file is stale (CI).
set -eu
cd "$(dirname "$0")/.."
DB="${TEST_DB:-vf_test}"
if [ "${SKIP_MIGRATE:-}" != 1 ]; then
  sh supabase/tests/run.sh > /dev/null
fi
schema=$(mktemp)
out=$(mktemp)
psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -f tools/db-types.sql > "$schema"
node tools/db-types.mjs "$schema" > "$out"
npx prettier --stdin-filepath src/common/fleet/database.d.ts < "$out" > "$out.formatted"
if [ "${1:-}" = "--check" ]; then
  if ! diff -u src/common/fleet/database.d.ts "$out.formatted"; then
    echo "src/common/fleet/database.d.ts is stale: run sh tools/db-types.sh and commit it." >&2
    exit 1
  fi
  echo "Database types are up to date."
else
  cp "$out.formatted" src/common/fleet/database.d.ts
  echo "Wrote src/common/fleet/database.d.ts"
fi
rm -f "$schema" "$out" "$out.formatted"
