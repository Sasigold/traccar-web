#!/usr/bin/env sh
# Apply every migration to a fresh local database on top of the stand-in base schema, then run
# the RLS tests. Usage: PGHOST=... PGPORT=... PGUSER=postgres sh supabase/tests/run.sh
set -eu
cd "$(dirname "$0")/../.."
DB="${TEST_DB:-vf_test}"
psql -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/base_standin.sql
for file in supabase/migrations/*.sql; do
  echo "Applying $(basename "$file")"
  # pg_cron is not installed locally; base_standin.sql provides its schema.
  grep -v '^create extension if not exists pg_cron;' "$file" | run
done
for test in supabase/tests/*.test.sql; do
  echo "Running $(basename "$test")"
  run -f "$test"
done
echo "All database tests passed."
