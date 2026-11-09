#!/usr/bin/env sh
# Nightly backup ON THE VPS (review item FND-03). Install once:
#   scp deploy/backup.sh root@<vps>:/usr/local/bin/vf-backup && ssh root@<vps> chmod 700 /usr/local/bin/vf-backup
#   crontab -e   ->   30 1 * * * /usr/local/bin/vf-backup >> /var/log/vf-backup.log 2>&1
# Keeps KEEP_DAYS days locally. Set OFFSITE to an rclone remote (for example "b2:viper-backups")
# to also copy every backup off the server; a backup that lives on the same disk is not a backup.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/root/vf-backups/nightly}"
KEEP_DAYS="${KEEP_DAYS:-14}"
FLEET_DIR="${FLEET_DIR:-/docker/viper-fleet}"
TRACCAR_DIR="${TRACCAR_DIR:-/docker/traccar-ovjj}"
OFFSITE="${OFFSITE:-}"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/$stamp"
mkdir -p "$target"
chmod 700 "$BACKUP_DIR"

DB=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^supabase\/postgres(:|@|$)/ { print $1; exit }')
if [ -n "$DB" ]; then
  echo "$(date -u) fleet database ($DB)"
  docker exec "$DB" pg_dumpall -U postgres --globals-only > "$target/fleet-globals.sql"
  docker exec "$DB" pg_dump -U postgres -d postgres -Fc > "$target/fleet.dump"
  test -s "$target/fleet.dump"
fi

if [ -d "$FLEET_DIR/volumes/storage" ]; then
  echo "$(date -u) fleet files"
  tar czf "$target/fleet-storage.tgz" -C "$FLEET_DIR/volumes" storage
fi

# Traccar: its database container if it has one (MySQL / Postgres), otherwise its data folder (H2).
TDB=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^(mysql|mariadb|postgres)(:|@|$)/ && $1 ~ /traccar/ { print $1; exit }')
if [ -n "$TDB" ]; then
  echo "$(date -u) traccar database ($TDB)"
  case "$(docker inspect -f '{{.Config.Image}}' "$TDB")" in
    postgres*) docker exec "$TDB" sh -c 'pg_dump -U "${POSTGRES_USER:-postgres}" -Fc "${POSTGRES_DB:-traccar}"' > "$target/traccar.dump" ;;
    *) docker exec "$TDB" sh -c 'exec mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases' > "$target/traccar.sql" ;;
  esac
elif [ -d "$TRACCAR_DIR/data" ]; then
  echo "$(date -u) traccar data folder"
  tar czf "$target/traccar-data.tgz" -C "$TRACCAR_DIR" data
fi
[ -f "$TRACCAR_DIR/conf/traccar.xml" ] && cp "$TRACCAR_DIR/conf/traccar.xml" "$target/"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +

if [ -n "$OFFSITE" ]; then
  echo "$(date -u) offsite copy to $OFFSITE"
  rclone copy "$target" "$OFFSITE/$stamp"
fi
echo "$(date -u) backup done: $target"
