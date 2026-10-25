# Deployment Produksi — Cloudflare Pages + VPS + Cloudflare Tunnel + Neon

Panduan ini memasang aplikasi Absensi Magang dengan biaya tambahan **Rp0** (dengan asumsi
VPS 2 GB sudah dibayar) dan tanpa membuka port 80/443 ke publik.

```
Browser (HTTPS)
      │
      ▼
Cloudflare Pages  ── /api/* ──►  Cloudflare Pages Function
(Next.js static export)                 │
                                        ▼
                              Cloudflare Tunnel
                                        │
                                        ▼
                         NestJS API (127.0.0.1:3001)
                                        │
                                        ▼
                              Neon PostgreSQL (pooled)
```

- **Frontend** berupa HTML/CSS/JS statis di Cloudflare Pages.
- **Proxy `/api/*`** berjalan sebagai Pages Function. Browser hanya berkomunikasi dengan
  origin Pages, sehingga cookie JWT tetap first-party dan `SameSite=Lax` dapat dipakai.
- **API** berjalan di VPS dan hanya listen di `127.0.0.1:3001`.
- **Cloudflare Tunnel** menjadi jalur masuk HTTPS tanpa membuka port apa pun.
- **Neon** tetap dipakai; tidak ada perubahan engine database.
- **Backup** harian `pg_dump` ke Cloudflare R2 untuk menutup keterbatasan restore Neon Free.

> **Prasyarat penting:** hostname Tunnel (`api.<domain>`) memerlukan domain yang DNS-nya
> dikelola Cloudflare. `*.pages.dev` tidak bisa dipakai untuk Tunnel. Frontend boleh tetap
> memakai `<project>.pages.dev` atau custom domain.
>
> **Belum punya domain?** Tunnel publik memerlukan zone Cloudflare. Untuk uji coba saja,
> `cloudflared tunnel --url http://127.0.0.1:3001` menghasilkan URL `*.trycloudflare.com`
> yang berubah setiap restart (tidak cocok untuk produksi). Untuk produksi tanpa domain,
> alternatifnya Tailscale Funnel; namun panduan ini memakai Cloudflare Tunnel + domain.
>
> **Panduan alternatif tanpa domain:** lihat [`tailscale.md`](tailscale.md) — VPS +
> Tailscale Funnel + Cloudflare Pages, tanpa Cloudflare Tunnel dan tanpa membeli domain.

---

## 1. Yang perlu disiapkan

- VPS Ubuntu 22.04/24.04, RAM 2 GB, akses SSH.
- Domain di Cloudflare (paket Free cukup), mis. `example.com`.
- Project Neon PostgreSQL (sudah ada).
- Akun Cloudflare (Pages + Tunnel + R2).
- Repository GitHub berisi kode ini.
- Bucket R2 privat untuk backup (opsional tetapi sangat disarankan).

Contoh nama yang dipakai di panduan:

| Nilai | Contoh |
| --- | --- |
| Domain | `example.com` |
| Hostname API | `api.example.com` |
| Project Pages | `absensi-magang` |
| URL Pages | `https://absensi-magang.pages.dev` |
| User VPS | `absensi` |
| Direktori aplikasi | `/opt/absensi` |

Ganti semua nilai `<...>` sesuai kondisi Anda.

---

## 2. Siapkan VPS

### 2.1. User, firewall, dan swap

```bash
sudo adduser --disabled-password --gecos "" absensi
sudo mkdir -p /opt/absensi /etc/absensi /var/backups/absensi
sudo chown -R absensi:absensi /opt/absensi /var/backups/absensi

sudo apt-get update
sudo apt-get install -y git curl build-essential ufw rclone

# Firewall: hanya SSH. API tidak membuka port 3001/80/443.
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable
```

Swap 2 GB disarankan agar `npm ci`/build tidak OOM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
swapon --show
```

### 2.2. Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # minimal v20.9, disarankan v22
```

### 2.3. PostgreSQL client untuk `pg_dump`

Versi client harus **sama atau lebih baru** dari server Neon. Pasang client bawaan
distro terlebih dahulu untuk mengecek versi server:

```bash
sudo apt-get install -y postgresql-client
psql "<DIRECT_URL_NEON>" -c 'show server_version;'
```

Jika server memakai PostgreSQL 17, pasang client 17 dari repositori PGDG:

```bash
sudo install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update
sudo apt-get install -y postgresql-client-17
```

### 2.4. Clone repository

Repo kemungkinan privat. Buat **deploy key read-only** di GitHub, lalu clone via SSH:

```bash
sudo -u absensi mkdir -p /home/absensi/.ssh
sudo chmod 700 /home/absensi/.ssh

sudo -u absensi ssh-keygen -t ed25519 -C "absensi-vps" \
  -f /home/absensi/.ssh/id_ed25519 -N ""
sudo -u absensi bash -c 'ssh-keyscan github.com >> ~/.ssh/known_hosts'
sudo cat /home/absensi/.ssh/id_ed25519.pub
```

Tambahkan public key tersebut di **GitHub → Settings → Deploy keys → Add deploy key**
(hanya read access). Setelah itu:

```bash
sudo -u absensi git clone git@github.com:Stackpilot02/Absensi_Magang.git /opt/absensi
```

---

## 3. Konfigurasi API

### 3.1. File environment

```bash
sudo cp /opt/absensi/deploy/vps/api.env.example /etc/absensi/api.env
sudo nano /etc/absensi/api.env
```

Isi minimal:

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

CORS_ORIGIN="https://absensi-magang.pages.dev"

PROXY_SHARED_SECRET="<openssl rand -hex 32>"

WORK_START_TIME="07:30"
WORK_END_TIME="16:00"
LATE_TOLERANCE_MINUTES="0"
MAX_CLOCK_SKEW_SECONDS="300"
```

Buat secret:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -hex 32      # PROXY_SHARED_SECRET
```

Amankan file:

```bash
sudo chown root:absensi /etc/absensi/api.env
sudo chmod 640 /etc/absensi/api.env
```

`PROXY_SHARED_SECRET` harus **sama persis** dengan yang nanti diisi di Cloudflare Pages.
Tanpa secret ini, API tetap berjalan tetapi rate limit dan audit log memakai IP proxy,
bukan IP pengguna.

### 3.2. Install, migrasi, dan build

```bash
cd /opt/absensi

# --include=dev wajib: NODE_ENV=production akan melewati devDependencies
sudo -u absensi npm ci --include=dev \
  --workspace @absensi/api --include-workspace-root --no-audit --no-fund

# Generate + build + migrasi memakai environment production.
sudo -u absensi bash -c '
  set -a; source /etc/absensi/api.env; set +a
  npm run db:generate
  npm run build --workspace @absensi/api
  npm run prisma:deploy --workspace @absensi/api
'
```

Seed hanya untuk database baru:

```bash
sudo -u absensi bash -c '
  set -a; source /etc/absensi/api.env; set +a
  npm run db:seed
'
```

Jangan memakai `prisma db push` di production.

### 3.3. Systemd service

```bash
sudo cp /opt/absensi/deploy/vps/absensi-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now absensi-api
sudo systemctl status absensi-api --no-pager
```

Uji dari VPS:

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3001/api/health/db
```

Jika gagal:

```bash
sudo journalctl -u absensi-api -n 100 --no-pager
```

### 3.4. Izinkan deploy user me-restart service

Agar `deploy/vps/deploy.sh` dapat dijalankan sebagai `absensi`:

```bash
sudo visudo -f /etc/sudoers.d/absensi-deploy
```

Isi:

```
absensi ALL=(root) NOPASSWD: /usr/bin/systemctl restart absensi-api, /usr/bin/systemctl status absensi-api
```

Path `systemctl` dapat dicek dengan `command -v systemctl`. Sesuaikan bila berbeda.

---

## 4. Cloudflare Tunnel

### 4.1. Pasang `cloudflared`

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

Untuk VPS ARM, ganti `amd64` menjadi `arm64`.

### 4.2. Login dan buat tunnel

```bash
cloudflared tunnel login
```

Perintah ini menampilkan URL. Buka di browser lokal, pilih zone `example.com`, lalu
kembali ke VPS. Selanjutnya:

```bash
cloudflared tunnel create absensi-api
cloudflared tunnel route dns absensi-api api.example.com
```

Catat UUID yang muncul (contoh `1234abcd-...`).

### 4.3. Konfigurasi service

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<UUID>.json /etc/cloudflared/<UUID>.json
sudo chmod 600 /etc/cloudflared/<UUID>.json

sudo cp /opt/absensi/deploy/cloudflared/config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
```

Ganti `GANTI_DENGAN_TUNNEL_UUID` dan `api.example.com`. Pastikan ingress terakhir
`http_status:404` tetap ada.

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

Uji dari luar VPS:

```bash
curl -fsS https://api.example.com/api/health
```

Di Cloudflare Dashboard → **SSL/TLS → Overview**, pilih **Full** (bukan Flexible).
Port 80/443 dan 3001 tetap tertutup di firewall.

> Jika `cloudflared service install` tidak menemukan config, jalankan:
> `sudo cloudflared --config /etc/cloudflared/config.yml service install`.

---

## 5. Cloudflare Pages

### 5.1. Buat project

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Pilih repository ini.
3. Nama project: `absensi-magang` (URL menjadi `https://absensi-magang.pages.dev`).
4. Framework preset: **None** (jangan pilih Next.js/next-on-pages; kita memakai
   static export murni).
5. Build command:

   ```bash
   npm ci --include=dev && npm run build --workspace @absensi/web
   ```

6. Build output directory: `apps/web/out`
7. Root directory: `/` (root repository, agar folder `functions/` terdeteksi).

### 5.2. Environment variables

Tambahkan di **Settings → Variables and Secrets** untuk **Production**:

| Nama | Nilai | Catatan |
| --- | --- | --- |
| `NODE_VERSION` | `22` | Build image Pages |
| `NEXT_TELEMETRY_DISABLED` | `1` | |
| `NEXT_PUBLIC_API_URL` | `/api` | Dipakai browser; same-origin |
| `NEXT_PUBLIC_SHOW_DEMO_HINTS` | `false` | Jangan tampilkan akun demo |
| `API_ORIGIN` | `https://api.example.com` | Origin Tunnel, tanpa `/api` |
| `PROXY_SHARED_SECRET` | sama dengan API | Simpan sebagai secret bila tersedia |

`NEXT_PUBLIC_*` akan tertanam di bundle browser. `API_ORIGIN` dan
`PROXY_SHARED_SECRET` hanya dipakai function di server Cloudflare.

### 5.3. Deploy pertama dan CORS

Setelah deploy selesai, salin URL Pages. Perbarui `/etc/absensi/api.env`:

```env
CORS_ORIGIN="https://absensi-magang.pages.dev"
```

Jika memakai custom domain, tambahkan juga (dipisah koma):

```env
CORS_ORIGIN="https://absensi-magang.pages.dev,https://absensi.example.com"
```

Lalu restart:

```bash
sudo systemctl restart absensi-api
```

`CORS_ORIGIN` harus sama persis dengan origin browser: scheme + host, **tanpa**
trailing slash. Origin ini dipakai CORS sekaligus `OriginGuard` anti-CSRF.

### 5.4. Preview deployment

Preview Pages memakai URL acak (`<hash>.absensi-magang.pages.dev`). Request tulis
(POST/PATCH/DELETE) akan ditolak `OriginGuard` bila origin preview tidak ada di
`CORS_ORIGIN`. Untuk uji preview, tambahkan origin tersebut sementara, atau gunakan
environment Preview terpisah dengan API/CORS sendiri.

---

## 6. Verifikasi

1. **API langsung:**
   ```bash
   curl -i https://api.example.com/api/health
   ```
2. **API lewat proxy Pages:**
   ```bash
   curl -i https://absensi-magang.pages.dev/api/health
   ```
3. **Login browser:** buka URL Pages, login dengan akun magang.
4. **Cookie:** DevTools → Application → Cookies. `absensi_token` harus:
   - `HttpOnly`
   - `Secure`
   - `SameSite=Lax`
   - domain = host Pages
5. **Geolocation:** tombol presensi meminta izin lokasi (HTTPS aktif).
6. **Audit log:** setelah check-in, `audit_log.ip` harus IP publik pengguna,
   bukan `127.0.0.1`. Jika salah, periksa kesamaan `PROXY_SHARED_SECRET`.
7. **Rate limit:** login dibatasi 8 request/menit per IP. Jika seluruh pengguna
   berada di NAT kantor yang sama dan login bersamaan, pertimbangkan menaikkan
   batas di `apps/api/src/auth/auth.controller.ts` (dengan tetap mempertimbangkan
   brute force).
8. **Download:** ekspor Excel/PDF harus berhasil melewati proxy.
9. **Logout:** cookie harus terhapus.

---

## 7. Update aplikasi

### Frontend

Cloudflare Pages otomatis deploy ulang setiap push ke branch produksi (biasanya `main`).

### Backend

Setelah perubahan di-merge ke `main`:

```bash
cd /opt/absensi
./deploy/vps/deploy.sh
```

Lakukan di luar jam sibuk. Script akan `git pull --ff-only`, install dependency,
generate Prisma Client, build, `prisma migrate deploy`, lalu restart service.

API belum otomatis ter-deploy karena kredensial SSH VPS belum tersedia. Jika ingin
otomatis, tambahkan GitHub Actions dengan secret `VPS_HOST`, `VPS_USER`, dan
`VPS_SSH_KEY`, lalu jalankan script yang sama. Jangan commit private key.

---

## 8. Backup dan restore

Neon Free hanya menyediakan restore window terbatas. Backup harian ke R2 menutup
keterbatasan itu.

### 8.1. Siapkan R2

1. Cloudflare Dashboard → **R2** → **Create bucket** → `absensi-backup` (private).
2. Buat **R2 API token** dengan izin Object Read & Write untuk bucket tersebut.
3. Di VPS, konfigurasi rclone sebagai root:

   ```bash
   sudo -i
   rclone config
   # n) New remote
   # name: r2
   # Storage: s3
   # provider: Cloudflare
   # access_key_id: <ACCESS_KEY_ID>
   # secret_access_key: <SECRET_ACCESS_KEY>
   # endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```

### 8.2. Pasang script backup

```bash
sudo cp /opt/absensi/deploy/backup/backup.env.example /etc/absensi/backup.env
sudo nano /etc/absensi/backup.env
sudo chown root:root /etc/absensi/backup.env
sudo chmod 600 /etc/absensi/backup.env

sudo chmod +x /opt/absensi/deploy/backup/backup-db.sh
sudo cp /opt/absensi/deploy/backup/absensi-backup.cron /etc/cron.d/absensi-backup
sudo chmod 644 /etc/cron.d/absensi-backup
sudo cp /opt/absensi/deploy/backup/absensi-backup.logrotate /etc/logrotate.d/absensi-backup
```

Uji manual:

```bash
sudo /opt/absensi/deploy/backup/backup-db.sh
sudo rclone lsf r2:absensi-backup/absensi/
```

### 8.3. Uji restore ke Neon branch

**Jangan uji restore ke database production.** Buat branch Neon baru, lalu:

```bash
sudo rclone copy r2:absensi-backup/absensi/absensi-<stamp>.dump /tmp/
pg_restore \
  --clean --if-exists \
  --no-owner --no-privileges \
  -d "<DIRECT_URL_BRANCH_NEON>" \
  /tmp/absensi-<stamp>.dump
```

Setelah yakin, hapus branch uji. Lakukan uji restore minimal sekali sebulan.

---

## 9. Troubleshooting

| Gejala | Kemungkinan penyebab | Tindakan |
| --- | --- | --- |
| `502 API tidak dapat dihubungi` | API mati, Tunnel mati, `API_ORIGIN` salah | `systemctl status absensi-api cloudflared`; cek `curl https://api.../api/health` |
| `500 Konfigurasi server belum lengkap` | `API_ORIGIN`/`PROXY_SHARED_SECRET` belum diisi di Pages | Isi Variables & Secrets, redeploy |
| `403 Origin permintaan tidak diizinkan` | `CORS_ORIGIN` tidak sama dengan origin browser | Samakan scheme+host, tanpa trailing slash; restart API |
| Login berhasil tetapi cookie tidak tersimpan | `COOKIE_SECURE=true` tetapi situs diakses via HTTP; `Set-Cookie` tidak diteruskan | Akses via HTTPS; cek response proxy |
| `429 Too Many Requests` | Rate limit per IP | Cek IP di audit log; pastikan `PROXY_SHARED_SECRET` sama; pertimbangkan batas login |
| `prisma migrate deploy` gagal | Memakai `DATABASE_URL` pooled / `DIRECT_URL` salah | Migrasi memakai `DIRECT_URL` tanpa `pgbouncer=true` |
| `cloudflared` 404 | UUID/hostname tidak cocok, DNS belum dibuat | Periksa `config.yml`, `cloudflared tunnel route dns` |
| `/api/*` 404 di Pages | Folder `functions/` tidak terdeteksi / output salah | Root directory `/`, build output `apps/web/out`, cek `_routes.json` |
| `npm ci` kehabisan memori | VPS 2 GB tanpa swap | Aktifkan swap; jalankan build di luar jam sibuk |
| Neon lambat pada request pertama | Compute suspend | Normal; `GET /api/health/db` dapat dipakai untuk pemanasan |
| `pg_dump` error versi | Client lebih lama dari server | Pasang `postgresql-client` yang sesuai |

Log yang berguna:

```bash
sudo journalctl -u absensi-api -n 100 --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
tail -n 50 /var/log/absensi-backup.log
```

---

## 10. Catatan keamanan

- API hanya listen `127.0.0.1:3001`; firewall tidak membuka 3001/80/443.
- Cloudflare Tunnel memakai koneksi keluar, bukan port masuk.
- Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; browser hanya melihat origin Pages.
- `PROXY_SHARED_SECRET` mencegah penyalahgunaan `X-Client-IP`; header dihapus
  sebelum request masuk ke guard/audit.
- `OriginGuard` tetap aktif untuk request tulis.
- File `/etc/absensi/api.env` dan kredensial Tunnel harus `600`/`640`.
- Bucket R2 harus privat. Backup berisi data pribadi pegawai.
- Jangan commit `.env`, kredensial Tunnel, atau private key.
- Jika secret bocor, rotasi `JWT_SECRET` (semua sesi logout) dan
  `PROXY_SHARED_SECRET` (perbarui di API dan Pages).
