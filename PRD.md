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
| Login + JWT | Selesai | Cookie `httpOnly`, rate limit login, ganti password |
| Dashboard Pegawai | Selesai | Check-in/out, statistik bulanan, tren 7 hari |
| Dashboard Admin/Pembimbing/Kepala | Selesai | Statistik peserta, rekap harian, aktivitas terbaru |
| Riwayat | Selesai | Filter tanggal, status, pagination |
| Data Mahasiswa | Selesai | CRUD peserta (NIM, kampus, prodi, HP, periode, pembimbing) |
| Laporan | Selesai | Rekap bulanan + ekspor Excel (2 sheet) & PDF siap tanda tangan |
| Profil | Selesai | Ubah data diri & password |
| Izin & Sakit | Selesai | Pengajuan peserta + persetujuan pembimbing/admin |
| Pengaturan | Selesai | Lokasi & radius kantor, audit log |
| Geofencing | Selesai | Haversine di server, radius default 100 m |
| Anti manipulasi waktu | Selesai | Jam server sebagai acuan + validasi selisih jam perangkat |
| Audit log | Selesai | Interceptor global untuk request tulis |
| Data dummy | Selesai | `prisma/seed.ts` (peserta, absensi 1 bulan, pengajuan izin) |

### Keputusan teknis
1. **Frontend lebih dulu dengan data dummy** tetap dipenuhi: seed database berisi peserta
   dan absensi dummy, sehingga UI dapat didemokan tanpa input manual. Integrasi API
   dilakukan sejak awal agar tidak ada pekerjaan ulang.
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

### Asumsi yang perlu dikonfirmasi
- Koordinat kantor BPS Kabupaten Padang Lawas pada seed masih perkiraan (Sibuhuan).
- Jam masuk 08:00 dan toleransi keterlambatan 15 menit.
- `LIBUR` hanya Sabtu/Minggu; hari libur nasional belum dikelola sebagai master data.

### Di luar cakupan iterasi ini
- Master hari libur nasional.
- Notifikasi email/WhatsApp.
- PWA/offline mode.

