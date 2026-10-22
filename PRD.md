# PRD
## Sistem Absensi Pegawai Magang BPS Kabupaten Padang Lawas

### Roadmap
1. **Frontend terlebih dahulu**
- Login
- Dashboard Pegawai
- Dashboard Admin
- Riwayat
- Data Mahasiswa
- Laporan
- Profil
- Menggunakan data dummy.

2. **Backend**
- REST API
- Authentication
- Attendance
- Report
- Integrasi frontend.

### Fitur
- Check in/out
- Validasi GPS radius kantor
- Riwayat
- Lapor kegiatan harian (logbook magang)
- Export Excel/PDF

## Rekomendasi Tambahan
- Role: Admin, Pembimbing, Pegawai Magang, Kepala BPS
- Data peserta: NIM, asal kampus, prodi, HP, periode magang
- Status: Hadir, Terlambat, Izin, Sakit, Alpha, Libur
- Dashboard statistik
- Audit log
- Geofencing
- Anti manipulasi waktu perangkat

---

## Status Implementasi (diperbarui 22 Oktober 2026)

Bagian ini bersifat aditif dan mencatat keputusan teknis selama implementasi.

### Yang sudah diimplementasikan
| Area | Status | Keterangan |
| --- | --- | --- |
| Login + JWT | Selesai | Cookie `httpOnly`, rate limit login, login memakai email **atau username**, ganti password |
| Dashboard Pegawai | Selesai | Kartu absensi bergaya aplikasi mobile (header biru, jam datang/pulang, 3 tile) + statistik bulanan & tren 7 hari |
| Dashboard Admin/Pembimbing/Kepala | Selesai | Statistik peserta, rekap harian, aktivitas terbaru |
| Riwayat | Selesai | Filter tanggal, status, pagination |
| Data Mahasiswa | Selesai | CRUD peserta (NIM, kampus, prodi, HP, periode, pembimbing) |
| Laporan | Selesai | Rekap bulanan + ekspor Excel (2 sheet) & PDF siap tanda tangan |
| Profil | Selesai | Ubah data diri & password |
| Izin & Sakit | Selesai | Pengajuan peserta + persetujuan pembimbing/admin |
| Lapor Kegiatan | Selesai | Logbook harian magang (tanggal, jam, uraian), scoping per peran, filter tanggal |
| Pengaturan | Selesai | Lokasi & radius kantor, audit log |
| Geofencing | Selesai | Haversine di server, radius default 100 m |
| Anti manipulasi waktu | Selesai | Jam server sebagai acuan + validasi selisih jam perangkat |
| Audit log | Selesai | Interceptor global untuk request tulis |
| Data awal | Selesai | `prisma/seed.ts` membuat kantor, 3 akun pengelola, dan 7 akun pegawai magang; tanpa absensi/izin/laporan palsu |
| Deployment | Siap (konfigurasi) | Cloudflare Pages + VPS + Cloudflare Tunnel + Neon; panduan di `deploy/README.md` |

### Keputusan teknis
1. **Data awal tanpa transaksi palsu**: seed database membuat kantor, akun pengelola, dan
   7 akun pegawai magang. Absensi, izin, dan laporan kegiatan tidak di-seed agar seluruh
   data transaksi berasal dari penggunaan nyata. UI tetap dapat didemokan setelah login.
2. **Zona waktu**: seluruh perhitungan tanggal memakai `Asia/Jakarta`, tidak bergantung zona server.
3. **Status `LIBUR`** dihitung otomatis untuk Sabtu/Minggu; `ALPHA` dihitung saat rekap
   bila tidak ada absensi dan tidak ada izin/sakit yang disetujui.
4. **Token** disimpan pada cookie `httpOnly` (bukan localStorage) untuk mengurangi risiko XSS.
5. **Database serverless (Neon)** dipilih sebagai opsi produksi karena tidak perlu mengelola
   server sendiri, mendukung branching untuk staging, dan kompatibel dengan Prisma.
   Implementasi memakai dua koneksi:
   - `DATABASE_URL` → pooled (`-pooler`, `pgbouncer=true`, `connection_limit=5`) untuk runtime.
   - `DIRECT_URL` → direct (tanpa `-pooler`) untuk `prisma migrate` dan seed.
   Konsekuensi yang ditangani: compute Neon bisa suspend saat idle, sehingga service
   Prisma melakukan retry koneksi (3 percobaan) dan tersedia endpoint `GET /api/health/db`
   untuk monitoring sekaligus memanaskan koneksi.

   **Status verifikasi (22 Oktober 2026):** pipeline database Neon sudah diuji langsung
   pada project Neon region Singapore — `prisma migrate deploy` (tabel & index terbentuk),
   seed akun awal, serta smoke test API end-to-end (login/RBAC, check-in & check-out,
   penolakan di luar radius 100 m, penolakan manipulasi jam perangkat, pengajuan & review
   izin, dashboard, export Excel/PDF, audit log, login throttle) berjalan sesuai harapan.

6. **Keamanan integrasi frontend–backend**: cookie JWT `httpOnly` + `OriginGuard` yang menolak
   request tulis (POST/PATCH/PUT/DELETE) dari origin di luar `CORS_ORIGIN`, untuk menutup risiko
   CSRF saat produksi memakai `SameSite=None`. Konfigurasi `COOKIE_SAME_SITE=none` wajib
   berpasangan dengan `COOKIE_SECURE=true`, dan build frontend production gagal bila
   `NEXT_PUBLIC_API_URL` kosong atau bukan URL absolut.

   > **Pembaruan 22 Oktober 2026:** pada arsitektur Cloudflare Pages + Tunnel, browser hanya
   > berkomunikasi dengan origin Pages dan proxy `/api` meneruskan cookie. Production memakai
   > `COOKIE_SAME_SITE=lax` + `COOKIE_SECURE=true`; `SameSite=None` tidak lagi diperlukan.
   > `NEXT_PUBLIC_API_URL` boleh berupa path relatif `/api`.

### Asumsi yang perlu dikonfirmasi
- Koordinat kantor BPS Kabupaten Padang Lawas: 1.0601° LU, 99.6644° BT (Plus Code 2PRV+8M8,
  Sibuhuan), radius 100 m — dikonfirmasi 22 Oktober 2026.
- Jam masuk 07:30, jam pulang 16:00, dan tanpa toleransi keterlambatan (diubah 22 Oktober 2026;
  sebelumnya 08:00 + 15 menit). Absen pulang ditolak sebelum pukul 16:00 WIB, baik di server
  maupun pada tombol dashboard.
- **Buat Kehadiran** memakai satu tombol kontekstual di kartu dashboard: tombol membuka panel
  kesesuaian lokasi, lalu tombol **Presensi** mencatat jam masuk (jika belum absen) atau jam
  pulang (jika sudah absen masuk). Jam yang tersimpan adalah waktu server dan langsung
  ditampilkan setelah berhasil.
- **Lapor Kegiatan**: pegawai magang menulis laporan harian (tanggal otomatis hari ini dan
  dapat diubah, jam kegiatan, serta uraian maksimal 1000 karakter). Tanggal tidak boleh
  melebihi hari ini. Pembimbing melihat laporan mahasiswa bimbingannya; admin/kepala BPS
  melihat seluruh laporan dan dapat memfilter rentang tanggal.
- **Tampilan kartu absensi** (22 Oktober 2026): header biru bermotif, avatar + nama + tombol
  keluar, tanggal berjalan dengan badge **WFO**, kartu **Jam Datang / Jam Pulang**, dan tiga
  tile aksi: **Presensi Bulanan** (ke halaman Riwayat), **Buat Kehadiran** (panel kesesuaian
  lokasi → Presensi), serta **Lapor Kegiatan**.
- **Akun pegawai magang (22 Oktober 2026)**: nama tanpa gelar, login memakai username unik
  (`sofi1221`, `khotimah1221`, `warida1221`, `cutdila1221`, `jihan1221`, `dian1221`,
  `cindy1221`). Email internal berformat `<username>@magang.local`; password awal `bps1221`.
  Lima akun pertama berlabel asal **MagangHub**, dua terakhir **Sekolah**.
- `LIBUR` hanya Sabtu/Minggu; hari libur nasional belum dikelola sebagai master data.

### Di luar cakupan iterasi ini
- Master hari libur nasional.
- Notifikasi email/WhatsApp.
- PWA/offline mode.

---

## Deployment Produksi (22 Oktober 2026)

Bagian ini bersifat aditif dan mencatat keputusan deployment terbaru. Requirement lama
(Vercel/Railway) tetap tercatat di README sebagai opsi alternatif.

### Arsitektur

| Komponen | Implementasi | Alasan |
| --- | --- | --- |
| Frontend | Next.js static export (`output: 'export'`) di Cloudflare Pages | Gratis, CDN global, tanpa server frontend |
| Proxy API | Cloudflare Pages Function `functions/api/[[path]].ts` | Request `/api/*` same-origin, cookie tetap first-party |
| Backend | NestJS di VPS 2 GB, systemd, listen `127.0.0.1:3001` | VPS sudah ada; tidak ada cold start |
| Jalur masuk | Cloudflare Tunnel `api.<domain>` | HTTPS tanpa membuka port 80/443 |
| Database | Neon PostgreSQL (pooled + direct) | Tetap dipakai; tidak migrasi ke MySQL |
| Backup | `pg_dump` harian ke Cloudflare R2 | Menutup restore window Neon Free yang terbatas |

Alur request: browser → Cloudflare Pages `/api/*` → Pages Function → Cloudflare Tunnel →
NestJS `127.0.0.1:3001` → Neon.

### Keputusan teknis

1. **Static export**: `headers()` di `next.config.ts` tidak didukung `output: 'export'`,
   sehingga header keamanan dipindah ke `apps/web/public/_headers`. `_routes.json`
   membatasi Pages Function hanya untuk `/api` dan `/api/*` agar kuota 100.000 request/hari
   tidak terpakai untuk aset statis.
2. **Cookie**: browser hanya melihat origin Pages, sehingga production memakai
   `COOKIE_SECURE=true` dan `COOKIE_SAME_SITE=lax`. API tidak men-set `Domain`, sehingga
   cookie menjadi host-only milik Pages.
3. **IP klien**: Pages Function mengambil `CF-Connecting-IP` dan mengirimnya sebagai
   `X-Client-IP` bersama `X-Proxy-Secret`. API hanya memakai header tersebut bila secret
   cocok dan nilainya valid menurut `isIP`, lalu menghapus header proxy sebelum guard/audit.
   Ini menjaga rate limit login (8/menit/IP) dan `audit_log.ip` tetap memakai IP pengguna.
4. **Binding API dan koneksi DB**: production memakai `HOST=127.0.0.1`; UFW tidak membuka
   port 3001/80/443. `trust proxy` diset `loopback` karena cloudflared berjalan di VPS yang
   sama. Runtime memakai `connection_limit=3` pada `DATABASE_URL` karena hanya ada satu
   instance API.
5. **Deployment**: Cloudflare Pages auto-deploy dari Git; API memakai
   `deploy/vps/deploy.sh` (pull, install, generate, build, migrate, restart). CI/CD API
   otomatis belum ditambahkan karena kredensial SSH VPS belum tersedia.
6. **Backup**: script `deploy/backup/backup-db.sh` memakai `DIRECT_URL` Neon, `pg_dump`
   format custom, validasi `pg_restore --list`, upload rclone ke R2 privat, retensi lokal
   14 hari dan R2 30 hari. Restore diuji ke Neon branch, bukan production.

### Batasan dan prasyarat

- Biaya tambahan Rp0 mengasumsikan VPS dan domain sudah dimiliki. Pembelian/perpanjangan
  domain baru adalah biaya di luar cakupan.
- Hostname Tunnel memerlukan domain yang DNS-nya dikelola Cloudflare. `*.pages.dev` tidak
  bisa dipakai untuk Tunnel; frontend boleh tetap di `*.pages.dev`.
- Cloudflare Pages Functions free tier: 100.000 request/hari. Dengan 7–10 pengguna, kuota
  ini jauh lebih dari cukup.
- Neon Free: 1 GB storage, 100 CU-hours/project/bulan, autosuspend setelah 5 menit,
  restore window 6 jam, 1 manual snapshot. Backup harian R2 menjadi lapisan pemulihan utama.
- VPS 2 GB menjalankan API + cloudflared; build frontend dilakukan di Cloudflare Pages,
  bukan di VPS. Swap 2 GB disarankan untuk `npm ci`/build API.
- Rate limit login 8 request/menit per IP. Jika seluruh pengguna berada di NAT kantor yang
  sama dan login bersamaan, batas ini perlu ditinjau (tanpa mengorbankan proteksi brute force).
- Preview deployment Cloudflare Pages memakai origin acak; request tulis akan ditolak
  `OriginGuard` sampai origin preview ditambahkan ke `CORS_ORIGIN`.

### Status

- Konfigurasi deployment disiapkan di branch `feat/deploy-cloudflare`.
- Eksekusi di VPS/Cloudflare/Neon/R2 **belum dilakukan** karena domain, akses SSH VPS,
  detail project Cloudflare, dan kredensial R2 belum tersedia.
- Panduan operasional lengkap: `deploy/README.md`.

### Asumsi yang perlu dikonfirmasi

- Domain utama dan hostname API (`api.<domain>`).
- Nama project Cloudflare Pages (`<project>.pages.dev`).
- OS/user VPS dan akses SSH.
- Region Neon dan versi PostgreSQL (menentukan versi `postgresql-client` untuk `pg_dump`).
- Nama bucket R2 dan kredensial backup.

