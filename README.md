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
│   │   ├── prisma/          # schema, seed data dummy
│   │   └── src/
│   │       ├── auth/        # login, JWT, ganti password
│   │       ├── users/       # data peserta & pembimbing
│   │       ├── attendance/  # check-in / check-out / riwayat / rekap
│   │       ├── office-locations/ # titik & radius kantor
│   │       ├── leaves/      # pengajuan izin & sakit
│   │       ├── reports/     # ekspor Excel & PDF
│   │       ├── dashboard/   # statistik dashboard
│   │       ├── audit/       # audit log
│   │       └── common/      # guard, decorator, util geo/waktu
│   └── web/                 # Next.js frontend
│       └── src/
│           ├── app/         # halaman (login, dashboard, riwayat, dst.)
│           ├── components/  # komponen UI shadcn-style + komponen aplikasi
│           └── lib/         # API client, tipe, util, geolokasi
├── docker-compose.yml       # PostgreSQL lokal
└── .github/workflows/ci.yml # pipeline CI (test + build)
```

## Prasyarat

- Node.js >= 20.9
- npm >= 10
- PostgreSQL 16 (lokal via Docker, atau Supabase untuk staging/production)

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

   Wajib mengganti `JWT_SECRET` dengan string acak minimal 32 karakter.

3. **Jalankan PostgreSQL**

   ```bash
   docker compose up -d
   ```

   Port default `5433` agar tidak bentrok dengan PostgreSQL lain di mesin lokal.

4. **Migrasi & data dummy**

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

### Akun demo (hasil seed)

| Peran       | Email                                | Password     |
| ----------- | ------------------------------------ | ------------ |
| Admin       | admin@padanglawas.bps.go.id          | `Magang#2026` |
| Pembimbing  | pembimbing@padanglawas.bps.go.id     | `Magang#2026` |
| Kepala BPS  | kepala@padanglawas.bps.go.id         | `Magang#2026` |
| Magang      | siti@mahasiswa.ac.id                 | `Magang#2026` |

> Password seed dapat diubah lewat `SEED_DEFAULT_PASSWORD`. Data dummy hanya untuk lokal.

## Aturan Bisnis Absensi

| Aturan | Implementasi |
| --- | --- |
| Check-in 1×/hari | Unique constraint `(user_id, date)` + validasi service |
| Check-out setelah check-in | Ditolak bila belum check-in / sudah check-out |
| Radius default 100 m | `office_location.radius`, validasi haversine di server |
| Status kehadiran | `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPHA`, `LIBUR` |
| Toleransi keterlambatan | `WORK_START_TIME` + `LATE_TOLERANCE_MINUTES` (default 08:00 + 15 menit) |
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
| POST | `/attendance/check-in`, `/attendance/check-out` | pegawai magang |
| GET | `/attendance/today`, `/attendance/history`, `/attendance/summary` | sesuai role |
| GET/POST/PATCH/DELETE | `/office-locations` | lihat: semua; ubah: admin |
| POST/GET | `/leaves` | terautentikasi |
| PATCH | `/leaves/:id/review` | admin/pembimbing |
| GET | `/reports/excel`, `/reports/pdf` | sesuai role (magang: data sendiri) |
| GET | `/dashboard/summary`, `/dashboard/monthly` | sesuai role |
| GET | `/audit-logs` | admin |
| GET | `/health` | publik |

## Testing & Quality Gate

```bash
npm test                              # unit test backend (Jest)
npm run lint                          # typecheck backend & frontend
npm run build                         # build production kedua aplikasi
```

Unit test mencakup: perhitungan jarak geofencing, transisi status & keterlambatan,
perhitungan tanggal zona Jakarta, deteksi manipulasi jam perangkat, aturan check-in/out,
autentikasi & hashing password, serta pembuatan berkas Excel/PDF.

## Deployment

| Komponen | Platform | Catatan |
| --- | --- | --- |
| Frontend | Vercel | Set `NEXT_PUBLIC_API_URL` ke URL API publik |
| Backend | Railway | Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE=true`, `NODE_ENV=production` |
| Database | Supabase | Gunakan connection string pooler untuk runtime, direct untuk migrasi |

Langkah deploy backend:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run build --workspace @absensi/api
```

Karena frontend (Vercel) dan backend (Railway) berbeda domain, set
`COOKIE_SAME_SITE=none` dan `COOKIE_SECURE=true` agar cookie JWT terkirim.

## Catatan Keamanan

- Password disimpan dengan `bcrypt` (cost 12); data password tidak pernah dikembalikan API.
- JWT disimpan di cookie `httpOnly`, `sameSite`, dan `secure` pada production.
- Login dibatasi laju request (rate limit) untuk mencegah brute force.
- Semua input divalidasi `class-validator` + `ValidationPipe` (whitelist, forbid unknown).
- Query memakai Prisma sehingga bebas SQL injection; rendering React meng-escape XSS.
- Header keamanan dasar dipasang di Next.js (`X-Frame-Options`, `nosniff`, `Referrer-Policy`).
- Secret & kredensial hanya dibaca dari environment variable, tidak di-hardcode.

## TODO / Perlu Konfirmasi

- Koordinat resmi kantor BPS Kabupaten Padang Lawas pada seed masih perkiraan
  (lihat `apps/api/prisma/seed.ts`); sesuaikan lewat menu **Pengaturan** di aplikasi.
- Jam masuk kantor (08:00) dan toleransi 15 menit perlu dikonfirmasi ke pembimbing.
