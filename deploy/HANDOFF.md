# Handoff Sesi — Deployment Cloudflare Pages + VPS + Tunnel + Neon

Terakhir diperbarui: 22 Oktober 2026  
Branch: `feat/deploy-cloudflare`  
Status: **konfigurasi siap, eksekusi produksi belum dilakukan**

Dokumen ini adalah catatan serah-terima sesi. Jangan menulis token, password,
atau connection string asli ke file ini.

---

## 1. Posisi pekerjaan

Branch `feat/deploy-cloudflare` sudah di-push ke GitHub dan berisi 4 commit
deployment di atas branch `feat/lapor-kegiatan`:

| Commit | Isi |
| --- | --- |
| `88e6e4f` | `feat(web)`: static export Next.js + Pages Function proxy `/api` |
| `8fa59fb` | `feat(api)`: trust proxy, `X-Client-IP` + `PROXY_SHARED_SECRET`, bind `HOST` |
| `cbaa757` | `chore(deploy)`: konfigurasi VPS, Cloudflare Tunnel, backup R2 |
| `308c09a` | `docs`: README + PRD deployment |

Panduan operasional lengkap ada di [`deploy/README.md`](README.md).

### Verifikasi yang sudah lulus

- `npm run lint` — API, web, dan typecheck Cloudflare Function
- `npm test` — 13 suite / 94 test lulus
- `npm run build` dengan `NEXT_PUBLIC_API_URL=/api` — lulus
- Output `apps/web/out` berisi `_headers`, `_routes.json`, `404.html`,
  `dashboard.html`
- Tidak ada `localhost:3001` di bundle web
- Tidak ada secret yang di-commit

---

## 2. Yang belum selesai

1. **PR belum dibuat.** Token GitHub yang sempat dibagikan tidak memiliki akses
   ke repo `Stackpilot02/Absensi_Magang` (API mengembalikan `404`). Token
   tersebut sebaiknya sudah di-revoke.
2. **Cloudflare belum dikonfigurasi.** Belum ada Pages project, Tunnel, DNS
   `api.<domain>`, atau environment variables.
3. **VPS belum dikonfigurasi.** API belum dijalankan via systemd, cloudflared
   belum di-install, dan port belum ditutup.
4. **Backup R2 belum aktif.** Script sudah ada, tetapi bucket/kredensial belum
   diisi.

---

## 3. Lanjut di laptop rumah

### Prasyarat

- **Node.js 22 LTS** (minimum `>=20.9.0`), npm, dan Git.
- Tidak wajib Docker. Docker hanya dipakai jika ingin PostgreSQL lokal.
- Koneksi internet untuk memakai Neon.

### Ambil branch

```powershell
git fetch origin
git checkout feat/deploy-cloudflare
git pull --ff-only
```

### Install dependency

```powershell
npm ci
```

Jika environment Windows memiliki `NODE_ENV=production`, gunakan:

```powershell
npm ci --include=dev
```

### Environment

- API: salin `apps/api/.env.example` menjadi `apps/api/.env`, lalu isi
  `DATABASE_URL`, `DIRECT_URL`, dan `JWT_SECRET`.
- Web: salin `apps/web/.env.example` menjadi `apps/web/.env.local`.
  Untuk pengembangan lokal, `NEXT_PUBLIC_API_URL` boleh tetap
  `http://localhost:3001/api`.

Untuk Neon, gunakan dua connection string dari Neon Console:

- Pooled (`-pooler`) → `DATABASE_URL`
- Direct (tanpa `-pooler`) → `DIRECT_URL`

### Menjalankan lokal

```powershell
npm run dev:api
npm run dev:web
```

Buka `http://localhost:3000`.

### Verifikasi sebelum push

```powershell
npm test
npm run lint
$env:NEXT_PUBLIC_API_URL='/api'
$env:NEXT_PUBLIC_SHOW_DEMO_HINTS='false'
npm run build
```

---

## 4. Perlu Docker?

**Tidak perlu untuk deployment produksi.**

- Cloudflare Pages melakukan build di infrastruktur Cloudflare.
- API di VPS berjalan langsung dengan Node.js + systemd.
- Database memakai Neon PostgreSQL.
- Docker hanya opsional untuk PostgreSQL lokal:

```powershell
docker compose up -d
```

Lalu gunakan URL lokal dari komentar di `apps/api/.env.example`
(`localhost:5433`). Jika memakai Neon, lewati Docker sepenuhnya.

---

## 5. Checklist Cloudflare + VPS

### Cloudflare

- [ ] Domain sudah aktif di Cloudflare (nameserver mengarah ke Cloudflare).
- [ ] Cloudflare API token sementara dengan izin:
  - Account → Cloudflare Pages: Edit
  - Account → Cloudflare Tunnel: Edit
  - Zone → DNS: Edit
  - Zone → Zone: Read
- [ ] Cloudflare Account ID.
- [ ] Nama project Pages, misalnya `absensi-magang`.
- [ ] Pages build:
  - Build command: `npm ci --include=dev && npm run build --workspace @absensi/web`
  - Output directory: `apps/web/out`
  - Root directory: `/`
  - Environment: `NEXT_PUBLIC_API_URL=/api`,
    `NEXT_PUBLIC_SHOW_DEMO_HINTS=false`,
    `API_ORIGIN=https://api.<domain>`,
    `PROXY_SHARED_SECRET=<secret>`
- [ ] Tunnel `api.<domain>` → `http://127.0.0.1:3001`.
- [ ] DNS CNAME `api` → `<tunnel-id>.cfargotunnel.com` (proxied).

### VPS

- [ ] Node.js 22, Git, PostgreSQL client (`psql`, `pg_dump`, `pg_restore`).
- [ ] User `absensi` dan direktori `/opt/absensi`.
- [ ] `/etc/absensi/api.env` dengan `HOST=127.0.0.1`, `PORT=3001`,
      `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`,
      `CORS_ORIGIN=https://<pages-domain>`, `PROXY_SHARED_SECRET`,
      `TZ=Asia/Jakarta`.
- [ ] `cloudflared` terpasang dan service aktif.
- [ ] `systemd` service `absensi-api` aktif.
- [ ] UFW tidak membuka port 80/443/3001.
- [ ] `curl http://127.0.0.1:3001/api/health` berhasil.

### Backup R2 (opsional, disarankan)

- [ ] Bucket R2 privat.
- [ ] `rclone` terkonfigurasi.
- [ ] `/etc/absensi/backup.env` diisi.
- [ ] Cron harian dan logrotate aktif.
- [ ] Restore diuji ke Neon branch, bukan production.

---

## 6. Link PR

- Deployment saja:
  `https://github.com/Stackpilot02/Absensi_Magang/compare/feat/lapor-kegiatan...feat/deploy-cloudflare?expand=1`
- Semua perubahan dari `main`:
  `https://github.com/Stackpilot02/Absensi_Magang/compare/main...feat/deploy-cloudflare?expand=1`
- Fitur `feat/lapor-kegiatan`:
  `https://github.com/Stackpilot02/Absensi_Magang/compare/main...feat/lapor-kegiatan?expand=1`

Disarankan merge `feat/lapor-kegiatan` lebih dulu, lalu
`feat/deploy-cloudflare`.

---

## 7. Keamanan

- Revoke token GitHub yang pernah dibagikan di chat.
- Jangan pernah commit `.env`, `api.env`, `backup.env`, token Cloudflare,
  private key SSH, atau connection string Neon.
- Gunakan token/SSH sementara dan cabut setelah selesai.
- Jangan push ke `main` atau merge PR tanpa persetujuan.

---

## 8. Status merge ke `main` (25 Oktober 2026)

- Branch `feat/deploy-cloudflare` sudah di-merge ke `main` pada 25 Oktober 2026
  (merge commit `f274a51`), sehingga tidak perlu membuat PR deployment terpisah.
- Konflik saat merge hanya di `apps/web/next.config.ts` dan `apps/web/.env.example`:

  | Bagian | Penyelesaian |
  | --- | --- |
  | `output: 'export'` | Dipertahankan, tetapi hanya aktif saat build production |
  | `images.unoptimized` | Dipertahankan (ikut static export) |
  | `headers()` | Dihapus; header keamanan ada di `public/_headers` |
  | `allowedDevOrigins` | Dipertahankan, nilainya dari env `ALLOWED_DEV_ORIGINS` |
  | `rewrites()` `/api` | Hanya aktif saat dev |

- `.env.example` web kini mendokumentasikan dua mode: dev (`http://localhost:3001/api`
  atau `/api` + rewrite) dan production Cloudflare Pages (`/api`).
- CI (`.github/workflows/ci.yml`) kini juga menjalankan `npm run lint` sehingga
  typecheck Pages Function ikut diperiksa.
- Langkah yang masih tersisa tetap sama seperti bagian 2: buat project Cloudflare Pages,
  Tunnel, environment produksi di VPS, aktifkan backup R2, lalu verifikasi memakai
  bagian 6 `deploy/README.md`.
- Branch `feat/deploy-cloudflare` dan `feat/lapor-kegiatan` sudah dihapus (lokal maupun
  remote) karena seluruh isinya sudah masuk `main` lewat merge `f274a51`. Bagian 6
  (link PR) tidak dipakai lagi.
- Variabel `LOGIN_DEFAULT_DOMAIN` pada `apps/api/.env` lokal dihapus karena sudah tidak
  dipakai kode sejak login memakai kolom `username`.

---

## 9. Status produksi (25 Oktober 2026)

Deployment dijalankan lewat jalur **tanpa domain** (`deploy/tailscale.md`), bukan Cloudflare
Tunnel.

| Komponen | Nilai |
| --- | --- |
| Frontend | `https://absensi-magang-azt.pages.dev` (Cloudflare Pages, static export) |
| API | `https://absensi-vps.tail1b85de.ts.net` (Tailscale Funnel → `127.0.0.1:3001`) |
| VPS | Ubuntu 24.04, user `absensi`, systemd `absensi-api`, repo di `/opt/absensi` |
| Database | Neon (pooled + direct), `prisma migrate deploy` tanpa migrasi tertunda |
| Secret | `/etc/absensi/api.env` (`640`, owner `root:absensi`) dan environment Pages |

Konfigurasi penting:

- `CORS_ORIGIN` di API = `https://absensi-magang-azt.pages.dev` (harus diperbarui bila URL
  Pages berubah atau memakai custom domain).
- `API_ORIGIN` pada environment Pages = `https://absensi-vps.tail1b85de.ts.net` (tanpa
  trailing slash), dan `PROXY_SHARED_SECRET` sama persis dengan di VPS.
- `NEXT_PUBLIC_SHOW_DEMO_HINTS=false` sehingga blok akun demo tidak tampil di produksi.
- UFW aktif: hanya `22/tcp` dan `20128/tcp` terbuka; API tetap di loopback.

Verifikasi yang sudah lulus:

- `GET /api/health` dan `GET /api/health/db` langsung ke Funnel → `200`.
- `GET /api/health` lewat `pages.dev` → `200` (Pages Function proxy berfungsi).
- Login `POST /api/auth/login` lewat `pages.dev` → `200` dengan cookie
  `absensi_token` `HttpOnly; Secure; SameSite=Lax`.
- Bundle web produksi tidak memuat `localhost:3001` dan blok akun demo tidak dirender.
- `deploy/vps/deploy.sh` dapat me-restart service tanpa password (`sudoers` terpasang).

Yang belum dikerjakan:

- **Backup R2** (`deploy/README.md` bagian 8) — belum ada bucket/kredensial rclone.
- **Rotasi kredensial Neon** yang pernah tampil di percakapan.
- **Bersihkan akun demo** di database produksi bila tidak dipakai.
- Custom domain untuk Pages (opsional).

Catatan operasional: URL `*.ts.net` stabil selama `tailscaled` aktif dan Funnel tidak
di-reset. Bila hostname berubah, `API_ORIGIN` di Pages dan `CORS_ORIGIN` di API harus
diperbarui lalu Pages di-redeploy.

### Isolasi database dev (25 Oktober 2026)

- Branch Neon `production` dipakai API produksi di VPS.
- Branch Neon `dev` (auto-delete: **Never**) dipakai pengembangan lokal, sehingga seed dan
  `prisma migrate dev` tidak lagi menyentuh data produksi.
- `apps/api/.env` lokal menunjuk ke host `ep-summer-base-...` (branch `dev`);
  `/etc/absensi/api.env` di VPS menunjuk ke `ep-aged-resonance-...` (branch `production`).
- Kedua environment memakai `connection_limit=3` + `pgbouncer=true` untuk `DATABASE_URL`,
  dan `DIRECT_URL` tanpa `-pooler` untuk migrasi/seed.
- Data awal branch `dev` disalin saat pembuatan branch: 10 user, 3 migrasi, kantor
  BPS `1.0407875, 99.7441188`, radius 100 m.
- Bila skema berubah: jalankan `prisma migrate dev` di lokal (branch `dev`), commit
  migrasinya, lalu `prisma migrate deploy` di VPS lewat `deploy/vps/deploy.sh`.
