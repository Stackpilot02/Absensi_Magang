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

