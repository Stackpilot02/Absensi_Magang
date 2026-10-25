#!/usr/bin/env bash
set -euo pipefail

# Deploy API Absensi di VPS.
# Jalankan sebagai user `absensi` (bukan root), di luar jam sibuk.
#
# Contoh:
#   cd /opt/absensi && ./deploy/vps/deploy.sh
#   BRANCH=main ./deploy/vps/deploy.sh
#
# Prasyarat: user boleh menjalankan `sudo systemctl restart absensi-api`
# (lihat deploy/README.md bagian sudoers).

REPO_DIR="${REPO_DIR:-/opt/absensi}"
SERVICE_NAME="${SERVICE_NAME:-absensi-api}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-/etc/absensi/api.env}"

if [ "$(id -u)" -eq 0 ]; then
  echo "[deploy] Jalankan script ini sebagai user absensi, bukan root." >&2
  exit 1
fi

for cmd in git npm sudo; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[deploy] Perintah '$cmd' tidak ditemukan." >&2
    exit 1
  fi
done

cd "$REPO_DIR"

echo "[deploy] Mengambil kode terbaru dari origin/$BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "[deploy] Commit: $(git rev-parse --short HEAD)"

# NODE_ENV=production dari file env akan membuat npm melewati devDependencies
# (Nest CLI, TypeScript, Prisma CLI), sehingga install harus memaksa dev.
echo "[deploy] Install dependency API..."
npm ci --include=dev --workspace @absensi/api --include-workspace-root --no-audit --no-fund

if [ -r "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "[deploy] PERINGATAN: $ENV_FILE tidak dapat dibaca; migrasi akan gagal." >&2
fi

echo "[deploy] Generate Prisma Client..."
npm run db:generate

echo "[deploy] Build API..."
npm run build --workspace @absensi/api

echo "[deploy] Menjalankan migrasi database (prisma migrate deploy)..."
npm run prisma:deploy --workspace @absensi/api

echo "[deploy] Restart service $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --lines=10 status "$SERVICE_NAME" || true

echo "[deploy] Selesai."
