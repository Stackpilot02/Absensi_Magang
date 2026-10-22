Pengaturan project context dan environment:
Sebelum memulai tugas apa pun, WAJIB baca file PRD.md (atau PRD_<nama-project>.md) di root/docs project terlebih dahulu untuk memahami konteks, requirement, dan batasan project.
Jika PRD.md tidak ditemukan, informasikan ke user dan tanyakan lokasi dokumentasi sebelum melanjutkan — jangan berasumsi sendiri soal konteks project.
Jika ada perubahan requirement di tengah pengerjaan, update PRD.md secara aditif (lihat poin 4) agar tetap jadi sumber kebenaran (source of truth) yang terkini.
Code quality dan security:
Tulis kode yang modular, mudah dibaca, dan aman dari kerentanan umum (SQL injection, XSS, dll).
Untuk logic penting (validasi, auth, kalkulasi, generate dokumen, dll), tulis/pastikan unit test tersedia dan lulus.
Sebelum menyelesaikan tugas, pastikan kode sudah divalidasi, lulus test (jika ada), dan bebas dari kesalahan (jalankan build/lint/test yang tersedia).
Jangan hardcode credential, API key, atau secret ke dalam kode — gunakan environment variable.
Git workflow dan mandatory CI/CD trigger (wajib):
Granular Commit: Lakukan git commit untuk setiap 1 tugas/fitur kecil yang selesai dikerjakan. Gunakan format konvensi pesan commit (contoh: feat: ... atau fix: ...).
Auto Push (khusus fitur kecil/perbaikan minor): Setelah commit berhasil, seluruh test (jika ada) lulus, dan dipastikan bebas error, jalankan git push origin main.
Untuk fitur besar/berisiko: ikuti branching strategy di poin 6 — JANGAN langsung push ke main.
Catatan Penting: Perintah git push ke main adalah pemicu (trigger) otomatis untuk pipeline CI/CD (GitHub Actions) agar perubahan ter-deploy langsung.
Restrictions (Yang Dilarang):
❌ Dilarang melakukan git push jika kodingan masih bermasalah/error atau test masih gagal.
❌ Dilarang menjalankan perintah terminal berskala destruktif (rm -rf /, DROP DATABASE, dll) tanpa persetujuan.
❌ Dilarang mengubah struktur folder utama aplikasi tanpa instruksi spesifik.
❌ Dilarang menghapus atau menimpa dokumentasi yang sudah ada (PRD, dll) — tambahkan konten baru secara aditif, jangan menggantikan.
❌ Dilarang mengubah/menambah dependency besar (library baru, upgrade major version) tanpa persetujuan.
Menangani ambiguitas:
Jika instruksi atau requirement tidak jelas, JANGAN menebak lalu langsung menjalankan (apalagi sampai push ke main).
Tandai asumsi dengan komentar // TODO: konfirmasi di kode, atau tanyakan langsung ke user sebelum melanjutkan, terutama untuk perubahan yang berdampak ke production (mengingat auto-push di poin 3).
Branching strategy:
Untuk fitur kecil/perbaikan minor: commit & push langsung ke main sesuai poin 3.
Untuk fitur besar/berisiko (perubahan schema database, breaking change, dll): gunakan branch terpisah, buat Pull Request, dan tunggu review/merge dari user sebelum masuk main.
Definition of Done: Sebuah tugas dianggap selesai jika:
Build berhasil tanpa error.
Test (jika ada) lulus semua.
Tidak ada console.log/debug code tertinggal.
Tidak ada credential/secret yang ter-expose, dan sudah lolos basic security check (lihat poin 2).
Kode sudah sesuai konvensi project dan tidak menimbulkan warning baru.
Error handling & logging:
Jangan silent-fail — gunakan try/catch yang jelas dan tangani error secara eksplisit.
Log error secara informatif untuk debugging, tapi jangan expose data sensitif (password, token, data pribadi) ke log/console.
Bahasa dokumentasi & komentar kode:
Gunakan Bahasa Indonesia secara konsisten untuk komentar kode dan pesan commit di seluruh project.
