# Sistem Absensi Pegawai Magang — BPS Kabupaten Padang Lawas

Aplikasi full-stack untuk mencatat kehadiran pegawai magang dengan validasi lokasi
(geofencing), rekap otomatis, ekspor laporan Excel/PDF, dan audit log aktivitas.

- **Frontend:** Next.js 16 (App Router) + TailwindCSS + komponen shadcn/ui
- **Backend:** NestJS REST API + Prisma ORM
- **Database:** PostgreSQL
- **Auth:** JWT pada cookie `httpOnly`
- **Peta/Geolokasi:** Browser Geolocation + formula haversine di server

---

## Struktur Repository

```
.
├── apps/
│   ├── api/                 # NestJS REST API
│   │   ├── prisma/          # schema, migration, seed akun awal
│   │   └── src/
│   │       ├── auth/        # login, JWT, ganti password
│   │       ├── users/       # data peserta & pembimbing
│   │       ├── attendance/  # check-in / check-out / riwayat / rekap
│   │       ├── office-locations/ # titik & radius kantor
│   │       ├── leaves/      # pengajuan izin & sakit
│   │       ├── activities/  # laporan kegiatan harian magang
│   │       ├── reports/     # ekspor Excel & PDF
│   │       ├── dashboard/   # statistik dashboard
│   │       ├── audit/       # audit log
│   │       └── common/      # guard, decorator, util geo/waktu
│   └── web/                 # Next.js frontend
│       ├── public/          # _headers & _routes.json untuk Cloudflare Pages
│       └── src/
│           ├── app/         # halaman (login, dashboard, riwayat, dst.)
│           ├── components/  # komponen UI shadcn-style + komponen aplikasi
│           └── lib/         # API client, tipe, util, geolokasi
├── functions/               # Cloudflare Pages Function proxy /api/*
├── deploy/                  # konfigurasi VPS, Cloudflare Tunnel, backup R2
├── docker-compose.yml       # PostgreSQL lokal
└── .github/workflows/ci.yml # pipeline CI (test + build)
```

## Prasyarat

- Node.js >= 20.9
- npm >= 10
- PostgreSQL 16 — **Neon (serverless, direkomendasikan)** atau PostgreSQL lokal via Docker

> Database serverless (Neon) memakai dua connection string: **pooled** untuk runtime
> (`DATABASE_URL`) dan **direct** untuk migrasi/seed (`DIRECT_URL`). Detail di bawah.

## Menjalankan di Lokal

1. **Install dependency**

   ```bash
   npm install
   ```

2. **Siapkan environment**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   Isi `DATABASE_URL`, `DIRECT_URL`, dan ganti `JWT_SECRET` dengan string acak
   minimal 32 karakter.

3. **Siapkan database**

   **Opsi A — Neon (serverless, tanpa server sendiri):**

   1. Buat project di [neon.tech](https://neon.tech) (region terdekat: Singapore).
   2. Buka **Connect** di dashboard Neon, salin **dua** connection string:
      - `Pooled connection` (host mengandung `-pooler`) → `DATABASE_URL`
      - `Direct connection` (host tanpa `-pooler`) → `DIRECT_URL`
   3. Tambahkan parameter berikut pada `DATABASE_URL`:
      `?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=5`
   4. `DIRECT_URL` cukup `?sslmode=require&connect_timeout=15`.
   5. Jalankan migrasi & seed:

      ```bash
      npm run db:migrate
      npm run db:seed
      ```

   **Opsi B — PostgreSQL lokal:**

   ```bash
   docker compose up -d
   ```

   Lalu set kedua variabel ke database lokal (port default `5433`):

   ```env
   DATABASE_URL="postgresql://absensi:absensi_local_dev@localhost:5433/absensi_magang?schema=public"
   DIRECT_URL="postgresql://absensi:absensi_local_dev@localhost:5433/absensi_magang?schema=public"
   ```

   > Mengapa dua URL? Neon memakai PgBouncer dalam *transaction mode*. Runtime butuh
   > koneksi pooled agar jumlah koneksi efisien, sedangkan `prisma migrate`/`db seed`
   > butuh koneksi langsung karena menjalankan DDL (tidak didukung PgBouncer).

4. **Jalankan migrasi & seed akun awal** (bila belum)

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. **Jalankan aplikasi** (dua terminal)

   ```bash
   npm run dev:api   # http://localhost:3001/api
   npm run dev:web   # http://localhost:3000
   ```

### Akun awal (hasil seed)

Akun pegawai magang login memakai **username** (bisa juga email internalnya).

| Peran | Username | Email internal | Password |
| --- | --- | --- | --- |
| Admin | — | admin@padanglawas.bps.go.id | `bps1221` saat akun baru; akun lama tidak diubah |
| Pembimbing | — | pembimbing@padanglawas.bps.go.id | `bps1221` saat akun baru; akun lama tidak diubah |
| Kepala BPS | — | kepala@padanglawas.bps.go.id | `bps1221` saat akun baru; akun lama tidak diubah |
| Magang (MagangHub) | `sofi1221` | sofi1221@magang.local | `bps1221` |
| Magang (MagangHub) | `khotimah1221` | khotimah1221@magang.local | `bps1221` |
| Magang (MagangHub) | `warida1221` | warida1221@magang.local | `bps1221` |
| Magang (MagangHub) | `cutdila1221` | cutdila1221@magang.local | `bps1221` |
| Magang (MagangHub) | `jihan1221` | jihan1221@magang.local | `bps1221` |
| Magang (Sekolah) | `dian1221` | dian1221@magang.local | `bps1221` |
| Magang (Sekolah) | `cindy1221` | cindy1221@magang.local | `bps1221` |

> Password magang mengikuti `SEED_DEFAULT_PASSWORD` bila diisi, default `bps1221`. Seed hanya
> membuat akun dan kantor — tidak membuat absensi, izin, atau laporan kegiatan palsu. Akun
> pengelola yang sudah ada tidak diubah password-nya oleh seed.

## Aturan Bisnis Absensi

| Aturan | Implementasi |
| --- | --- |
| Check-in 1×/hari | Unique constraint `(user_id, date)` + validasi service |
| Check-out setelah check-in | Ditolak bila belum check-in / sudah check-out |
| Check-out jam pulang | Ditolak sebelum `WORK_END_TIME` (default **16:00 WIB**) |
| Radius default 100 m | `office_location.radius`, validasi haversine di server |
| Status kehadiran | `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPHA`, `LIBUR` |
| Toleransi keterlambatan | `WORK_START_TIME` + `LATE_TOLERANCE_MINUTES` (default **07:30 + 0 menit**) |
| Anti manipulasi jam | Jam server jadi acuan; selisih jam perangkat > `MAX_CLOCK_SKEW_SECONDS` ditolak |
| Akhir pekan | Sabtu/Minggu berstatus `LIBUR`, check-in ditolak |
| Periode magang | Check-in ditolak di luar rentang periode peserta |
| Audit log | Setiap request `POST/PATCH/PUT/DELETE` dicatat (body sensitif disamarkan) |

Tanggal absensi selalu dihitung pada zona **Asia/Jakarta**, bukan zona server.

## Ringkasan Endpoint REST

Semua endpoint berada di prefix `/api`.

| Method | Endpoint | Akses |
| --- | --- | --- |
| POST | `/auth/login` | publik (rate limited) |
| POST | `/auth/logout` | terautentikasi |
| GET | `/auth/me` | terautentikasi |
| POST | `/auth/change-password` | terautentikasi |
| GET/POST/PATCH/DELETE | `/users`, `/users/:id` | admin (lihat: admin/pembimbing/kepala) |
| GET | `/users/mentees` | admin/pembimbing |
| PATCH | `/users/me` | terautentikasi |
| POST | `/attendance/check-in`, `/attendance/check-out` | pegawai magang (satu tombol "Buat Kehadiran" di UI) |
| POST/GET | `/activities` | magang: laporan sendiri; pengelola: melihat laporan |
| PATCH/DELETE | `/activities/:id` | pemilik laporan (magang) |
| GET | `/attendance/today`, `/attendance/history`, `/attendance/summary` | sesuai role |
| GET/POST/PATCH/DELETE | `/office-locations` | lihat: semua; ubah: admin |
| POST/GET | `/leaves` | terautentikasi |
| PATCH | `/leaves/:id/review` | admin/pembimbing |
| GET | `/reports/excel`, `/reports/pdf` | sesuai role (magang: data sendiri) |
| GET | `/dashboard/summary`, `/dashboard/monthly` | sesuai role |
| GET | `/audit-logs` | admin |
| GET | `/health` | publik |
| GET | `/health/db` | publik (ping database / wake-up Neon) |

## Testing & Quality Gate

```bash
npm test                              # unit test backend (Jest)
npm run lint                          # typecheck backend, frontend, & Pages Function
npm run build                         # build production kedua aplikasi
```

> Build production memerlukan `NEXT_PUBLIC_API_URL`. Untuk verifikasi lokal dengan
> arsitektur Cloudflare Pages, set `NEXT_PUBLIC_API_URL=/api` terlebih dahulu
> (PowerShell: `$env:NEXT_PUBLIC_API_URL='/api'`).

Unit test mencakup: perhitungan jarak geofencing, transisi status & keterlambatan,
perhitungan tanggal zona Jakarta, deteksi manipulasi jam perangkat, aturan check-in/out,
autentikasi & hashing password, pembuatan berkas Excel/PDF, serta validasi IP klien dari
proxy Cloudflare (`X-Client-IP` + `PROXY_SHARED_SECRET`).

## Deployment Produksi — Cloudflare Pages + VPS + Cloudflare Tunnel + Neon

Arsitektur yang dipakai saat ini (biaya tambahan **Rp0** dengan asumsi VPS 2 GB dan domain
sudah ada):

| Komponen | Platform | Catatan |
| --- | --- | --- |
| Frontend | Cloudflare Pages | Next.js static export (`output: 'export'`), gratis |
| Proxy API | Cloudflare Pages Function | `functions/api/[[path]].ts` meneruskan `/api/*` ke Tunnel |
| Backend | VPS 2 GB + systemd | NestJS listen `127.0.0.1:3001`, tanpa membuka port 80/443 |
| Jalur masuk | Cloudflare Tunnel | Hostname `api.<domain>` → `http://127.0.0.1:3001` |
| Database | Neon PostgreSQL | Tetap memakai pooled `DATABASE_URL` + direct `DIRECT_URL` |
| Backup | Cloudflare R2 | `pg_dump` harian, retensi lokal 14 hari / R2 30 hari |

Panduan langkah demi langkah: [`deploy/README.md`](deploy/README.md).

Ringkasan alur:

1. Browser membuka `https://<project>.pages.dev` (atau custom domain).
2. Request `/api/*` diproxy oleh Pages Function ke `https://api.<domain>` melalui Tunnel.
3. API mengakses Neon; cookie JWT tetap first-party karena browser hanya melihat origin Pages.
4. `PROXY_SHARED_SECRET` menandai `X-Client-IP` agar audit log dan rate limit memakai IP asli.

Environment penting di production:

```env
# API VPS (/etc/absensi/api.env)
NODE_ENV="production"
HOST="127.0.0.1"
PORT="3001"
TZ="Asia/Jakarta"
COOKIE_SECURE="true"
COOKIE_SAME_SITE="lax"
CORS_ORIGIN="https://<project>.pages.dev"
PROXY_SHARED_SECRET="<openssl rand -hex 32>"

# Cloudflare Pages (Variables and Secrets)
NEXT_PUBLIC_API_URL="/api"
API_ORIGIN="https://api.<domain>"
PROXY_SHARED_SECRET="<sama dengan API>"
```

> Hostname Tunnel memerlukan domain yang DNS-nya dikelola Cloudflare; `*.pages.dev`
> tidak bisa dipakai untuk Tunnel. Frontend boleh tetap memakai `*.pages.dev`.

## Deployment (opsi lama: Vercel + Railway/Render)

> **Catatan:** bagian ini dipertahankan sebagai opsi alternatif. Untuk produksi saat ini,
> gunakan arsitektur Cloudflare Pages + VPS + Tunnel di atas.

| Komponen | Platform | Catatan |
| --- | --- | --- |
| Frontend | Vercel | Set `NEXT_PUBLIC_API_URL` ke URL API publik |
| Backend | Railway / Render | Set `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `NODE_ENV=production` |
| Database | Neon | Pooled URL (`-pooler`) untuk runtime, direct URL untuk migrasi |

Langkah deploy backend:

```bash
# memakai DIRECT_URL secara otomatis
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma db seed --schema apps/api/prisma/schema.prisma   # opsional, hanya data awal
npm run build --workspace @absensi/api
```

Catatan Neon untuk production:

- Gunakan **pooled connection** di `DATABASE_URL` dan **direct connection** di `DIRECT_URL`.
- Set `connection_limit=5` pada `DATABASE_URL` agar jumlah koneksi per instance terkendali
  (free tier Neon punya kuota koneksi terbatas).
- Neon meng-*suspend* compute setelah idle. Backend sudah melakukan retry koneksi
  otomatis (3 percobaan) dan menyediakan `GET /api/health/db` untuk uptime monitor.
- Aktifkan **History retention / backup** pada project Neon untuk kebutuhan audit.
- `CORS_ORIGIN` harus **sama persis** dengan origin frontend (contoh `https://absensi.example.com`,
  tanpa trailing slash). Nilai ini dipakai untuk CORS sekaligus validasi `Origin` anti-CSRF,
  dan boleh berisi beberapa origin dipisahkan koma.

Karena frontend (Vercel) dan backend (Railway) berbeda domain, set
`COOKIE_SAME_SITE=none` dan `COOKIE_SECURE=true` agar cookie JWT terkirim.

> **Pembaruan 22 Oktober 2026:** pada deployment Cloudflare Pages + Tunnel, browser hanya
> berkomunikasi dengan origin Pages dan proxy `/api` meneruskan cookie. Karena itu production
> memakai `COOKIE_SAME_SITE=lax` + `COOKIE_SECURE=true`; `SameSite=None` hanya berlaku untuk
> opsi lama di atas.

## Catatan Keamanan

- Password disimpan dengan `bcrypt` (cost 12); data password tidak pernah dikembalikan API.
- JWT disimpan di cookie `httpOnly`, `sameSite`, dan `secure` pada production.
- Login dibatasi laju request (rate limit) untuk mencegah brute force.
- Semua input divalidasi `class-validator` + `ValidationPipe` (whitelist, forbid unknown).
- Query memakai Prisma sehingga bebas SQL injection; rendering React meng-escape XSS.
- Header keamanan dasar dipasang melalui `apps/web/public/_headers` (`X-Frame-Options`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS) karena Next.js static export
  tidak mendukung `headers()`.
- `OriginGuard` menolak request yang mengubah data (POST/PATCH/PUT/DELETE) bila header
  `Origin` berasal dari luar `CORS_ORIGIN`. Pada arsitektur Cloudflare Pages + Tunnel,
  browser hanya berkomunikasi dengan origin Pages (proxy `/api`), sehingga production
  memakai `SameSite=Lax`; `SameSite=None` hanya untuk opsi lama.
- `COOKIE_SAME_SITE=none` wajib disertai `COOKIE_SECURE=true`; aplikasi menolak start
  bila kombinasinya salah, agar login tidak gagal diam-diam di browser.
- `PROXY_SHARED_SECRET` hanya dipercaya bila cocok; API memvalidasi `X-Client-IP` sebagai
  alamat IP sebelum memakainya untuk audit log dan rate limit. Header proxy dihapus dari
  request sebelum masuk ke guard.
- Build production frontend gagal bila `NEXT_PUBLIC_API_URL` kosong atau bukan path relatif
  (`/api`) / URL absolut yang valid, sehingga tidak mungkin ter-deploy dengan fallback
  `localhost`.
- Secret & kredensial hanya dibaca dari environment variable, tidak di-hardcode.

## Catatan Konfigurasi Kantor

- Koordinat kantor BPS Kabupaten Padang Lawas: **1.0601° LU, 99.6644° BT**
  (Plus Code `2PRV+8M8`, Sibuhuan), radius absensi **100 meter**.
  Nilai ini tersimpan di tabel `office_location` dan dapat diubah lewat menu **Pengaturan**.
- Jam masuk kantor **07:30 WIB tanpa toleransi** dan jam pulang **16:00 WIB** (diubah 22
  Oktober 2026; sebelumnya 08:00 + 15 menit). Absen pulang sebelum 16:00 ditolak server.
