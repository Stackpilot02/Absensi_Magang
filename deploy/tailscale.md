# Deployment Tanpa Domain — VPS + Tailscale Funnel + Cloudflare Pages + Neon

Dokumen ini adalah **jalur alternatif** dari `deploy/README.md` untuk kondisi belum punya
domain sendiri. Tujuannya sama: frontend statis di Cloudflare Pages, API NestJS di VPS,
database Neon, dan cookie JWT tetap first-party.

Perbedaan utama: pengganti Cloudflare Tunnel adalah **Tailscale Funnel**, yang memberi
alamat HTTPS stabil gratis berbentuk `https://<nama-vps>.<tailnet>.ts.net` tanpa perlu
membeli domain dan tanpa membuka port masuk di firewall.

```
Browser (HTTPS)
      │
      ▼
Cloudflare Pages (https://<project>.pages.dev)
      │  /api/*  →  Pages Function proxy
      ▼
Tailscale Funnel (https://<vps>.<tailnet>.ts.net)
      │
      ▼
NestJS API (127.0.0.1:3001)  ──►  Neon PostgreSQL
```

## Kapan memakai dokumen ini

| Kondisi | Pakai |
| --- | --- |
| Punya domain di Cloudflare | `deploy/README.md` (Cloudflare Tunnel) |
| Belum punya domain, ada VPS | **dokumen ini** (Tailscale Funnel) |
| Belum punya VPS maupun domain | PaaS gratis (Render/Railway) + Pages Function proxy |

## 1. Prasyarat

- VPS Ubuntu 22.04/24.04 (RAM 1–2 GB cukup) dengan akses SSH.
- Akun Tailscale gratis (https://login.tailscale.com/register).
- Akun Cloudflare gratis (untuk Pages).
- Project Neon yang sudah berisi skema + data (sama seperti `deploy/README.md`).
- Repository GitHub: `https://github.com/Stackpilot02/Absensi_Magang.git` (publik).

## 2. Siapkan VPS

```bash
sudo adduser --disabled-password --gecos "" absensi
sudo mkdir -p /opt/absensi /etc/absensi /var/backups/absensi
sudo chown -R absensi:absensi /opt/absensi /var/backups/absensi

sudo apt-get update
sudo apt-get install -y git curl build-essential ufw

# Firewall: cukup SSH. Tailscale Funnel memakai koneksi keluar (443).
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable
```

Swap 2 GB bila RAM VPS kecil:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

Clone repository (publik, jadi tanpa deploy key):

```bash
sudo -u absensi git clone https://github.com/Stackpilot02/Absensi_Magang.git /opt/absensi
```

## 3. Environment API

```bash
sudo cp /opt/absensi/deploy/vps/api.env.example /etc/absensi/api.env
sudo nano /etc/absensi/api.env
```

Isi minimal (nilai `<...>` diganti):

```env
NODE_ENV="production"
HOST="127.0.0.1"
PORT="3001"
TZ="Asia/Jakarta"

DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=3"
DIRECT_URL="postgresql://.../neondb?sslmode=require&connect_timeout=15"

JWT_SECRET="<openssl rand -base64 48>"
COOKIE_SECURE="true"
COOKIE_SAME_SITE="lax"

# Diisi setelah Pages pertama selesai deploy (lihat langkah 6).
CORS_ORIGIN="https://<project>.pages.dev"

PROXY_SHARED_SECRET="<openssl rand -hex 32>"

WORK_START_TIME="07:30"
WORK_END_TIME="16:00"
LATE_TOLERANCE_MINUTES="0"
MAX_CLOCK_SKEW_SECONDS="300"
```

```bash
sudo chown root:absensi /etc/absensi/api.env
sudo chmod 640 /etc/absensi/api.env
```

Build dan migrasi:

```bash
cd /opt/absensi
sudo -u absensi npm ci --include=dev --workspace @absensi/api --include-workspace-root --no-audit --no-fund
sudo -u absensi bash -c '
  set -a; source /etc/absensi/api.env; set +a
  npm run db:generate
  npm run build --workspace @absensi/api
  npm run prisma:deploy --workspace @absensi/api
'
```

> Seed hanya untuk database kosong. Jangan jalankan `db:seed` di database produksi yang
> sudah berisi data, dan jangan memakai `prisma db push`.

## 4. Systemd service

```bash
sudo cp /opt/absensi/deploy/vps/absensi-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now absensi-api
sudo systemctl status absensi-api --no-pager
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3001/api/health/db
```

Izinkan user `absensi` restart service (dipakai `deploy/vps/deploy.sh`):

```bash
sudo visudo -f /etc/sudoers.d/absensi-deploy
# isi:
# absensi ALL=(root) NOPASSWD: /usr/bin/systemctl restart absensi-api, /usr/bin/systemctl status absensi-api
```

## 5. Tailscale Funnel

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Buka URL yang muncul, login, lalu aktifkan Funnel untuk service ini:

```bash
# Cek nama host di tailnet.
tailscale status

# Aktifkan Funnel (publik) untuk port 3001 pada hostname mesin ini.
sudo tailscale funnel --bg 3001
```

Keluaran perintah terakhir memuat URL publik, contoh:

```
https://absensi-vps.tailXXXX.ts.net
```

Uji:

```bash
curl -fsS https://absensi-vps.tailXXXX.ts.net/api/health
```

Catatan:

- Funnel melakukan forward HTTPS (port 443) ke `http://127.0.0.1:3001`; API tetap tidak
  terbuka ke internet secara langsung.
- Funnel hanya mengizinkan port 443/8443/10000. Jangan ganti ke port lain.
- Nonaktifkan dengan `sudo tailscale funnel --bg off` (atau `tailscale funnel reset`).
- Simpan URL ts.net ini; nilainya dipakai sebagai `API_ORIGIN` di Cloudflare Pages.

## 6. Cloudflare Pages

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pilih repo `Absensi_Magang`.
2. Nama project: `absensi-magang` (URL menjadi `https://absensi-magang.pages.dev`).
3. Framework preset: **None**.
4. Build command:

   ```bash
   npm ci --include=dev && npm run build --workspace @absensi/web
   ```

5. Build output directory: `apps/web/out`.
6. Root directory: `/` (agar folder `functions/` ikut terdeteksi).
7. **Settings → Variables and Secrets → Production**:

   | Nama | Nilai |
   | --- | --- |
   | `NODE_VERSION` | `22` |
   | `NEXT_TELEMETRY_DISABLED` | `1` |
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `NEXT_PUBLIC_SHOW_DEMO_HINTS` | `false` |
   | `API_ORIGIN` | `https://<vps>.<tailnet>.ts.net` |
   | `PROXY_SHARED_SECRET` | sama persis dengan isi `/etc/absensi/api.env` |

8. **Deploy**. Setelah selesai, salin URL Pages (`https://absensi-magang.pages.dev`).

## 7. Sinkronkan CORS

`OriginGuard` menolak request tulis bila origin browser tidak terdaftar. Karena browser
hanya melihat origin Pages, isi `CORS_ORIGIN` dengan URL Pages:

```bash
sudo nano /etc/absensi/api.env
# CORS_ORIGIN="https://absensi-magang.pages.dev"
sudo systemctl restart absensi-api
```

Bila memakai custom domain nanti, tambahkan dipisah koma:

```env
CORS_ORIGIN="https://absensi-magang.pages.dev,https://absensi.example.com"
```

## 8. Verifikasi

1. `curl -i https://<vps>.<tailnet>.ts.net/api/health` → `200`.
2. `curl -i https://<project>.pages.dev/api/health` → `200` (lewat Pages Function).
3. Login di browser memakai akun magang → berhasil masuk.
4. DevTools → Application → Cookies: `absensi_token` harus `HttpOnly`, `Secure`,
   `SameSite=Lax`, domain = host Pages.
5. Absensi minta izin lokasi (HTTPS aktif) dan jarak ke kantor wajar.
6. Setelah check-in, `audit_log.ip` berisi IP publik pengguna, bukan IP proxy.

## 9. Update aplikasi

Frontend: otomatis ter-deploy saat push ke `main` (Pages build ulang).

Backend:

```bash
cd /opt/absensi && ./deploy/vps/deploy.sh
```

## 10. Troubleshooting khusus Tailscale

| Gejala | Penyebab | Tindakan |
| --- | --- | --- |
| `502 API tidak dapat dihubungi` | Funnel off / API mati | `sudo tailscale funnel status`; `systemctl status absensi-api` |
| Funnel aktif tapi 404 | Port salah | Funnel harus ke `3001`, bukan port lain |
| `403 Origin permintaan tidak diizinkan` | `CORS_ORIGIN` beda dengan origin Pages | Samakan scheme+host, tanpa trailing slash |
| Cookie tidak tersimpan | `COOKIE_SECURE=true` tapi diakses via HTTP | Selalu akses lewat HTTPS (pages.dev) |
| Funnel mati setelah reboot | Mode `--bg` tidak persisten pada beberapa versi | Jalankan ulang `sudo tailscale funnel --bg 3001` atau buat unit systemd |

## 11. Keamanan

- API hanya listen `127.0.0.1:3001`; UFW tidak membuka 3001/80/443.
- `PROXY_SHARED_SECRET` mencegah penyalahgunaan header `X-Client-IP`; header dihapus
  sebelum masuk guard/audit.
- `OriginGuard` tetap aktif untuk POST/PATCH/DELETE.
- File `/etc/absensi/api.env` harus `640` dengan owner `root:absensi`.
- Jangan commit `.env`, `api.env`, atau token Tailscale/Cloudflare.
- Rotasi `JWT_SECRET` bila bocor (semua sesi logout).
