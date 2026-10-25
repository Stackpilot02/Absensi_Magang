#!/usr/bin/env bash
set -euo pipefail

# Backup harian Neon PostgreSQL ke Cloudflare R2.
# Pasang di /etc/cron.d/absensi-backup (lihat deploy/README.md).
#
# File environment berisi kredensial; jangan commit ke git.

ENV_FILE="${ENV_FILE:-/etc/absensi/backup.env}"

if [ ! -r "$ENV_FILE" ]; then
  echo "[backup] File environment tidak ditemukan atau tidak dapat dibaca: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${NEON_DIRECT_URL:?NEON_DIRECT_URL wajib diisi}"
: "${R2_REMOTE:?R2_REMOTE wajib diisi, contoh r2:absensi-backup}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/absensi}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
FILE="$BACKUP_DIR/absensi-$STAMP.dump"
TMP_FILE="$FILE.partial"

umask 077
mkdir -p "$BACKUP_DIR"

# Cegah dua proses backup berjalan bersamaan.
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  echo "[backup] Proses backup lain masih berjalan; dilewati."
  exit 0
fi

for cmd in pg_dump pg_restore rclone; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[backup] Perintah '$cmd' tidak ditemukan." >&2
    exit 1
  fi
done

trap 'rm -f "$TMP_FILE"' EXIT

echo "[backup] Mulai: $STAMP"
pg_dump "$NEON_DIRECT_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$TMP_FILE"

# Pastikan file dump dapat dibaca sebelum diunggah.
pg_restore --list "$TMP_FILE" >/dev/null
mv "$TMP_FILE" "$FILE"
trap - EXIT
echo "[backup] Dump valid: $FILE ($(du -h "$FILE" | cut -f1))"

rclone copy "$FILE" "$R2_REMOTE/absensi/"
echo "[backup] Upload ke $R2_REMOTE selesai."

find "$BACKUP_DIR" -type f -name 'absensi-*.dump' -mtime +"$RETENTION_DAYS" -delete
rclone delete "$R2_REMOTE/absensi" --min-age "${REMOTE_RETENTION_DAYS}d"
echo "[backup] Selesai."
