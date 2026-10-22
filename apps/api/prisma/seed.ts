/**
 * Seed data dummy untuk pengembangan & demo.
 * Jalankan: npm run db:seed (dari root) atau npm run seed (di apps/api)
 */
import 'dotenv/config';
import { AttendanceStatus, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_DEV_PASSWORD = 'Magang#2026';

function resolveSeedPassword(): string {
  const fromEnv = process.env.SEED_DEFAULT_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_DEFAULT_PASSWORD wajib diisi saat menjalankan seed di production.');
  }

  // Hanya dipakai untuk data dummy di lingkungan lokal.
  return DEFAULT_DEV_PASSWORD;
}

/** Generator acak deterministik agar data demo konsisten. */
function createRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const random = createRandom(20261022);

function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function weekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

async function main(): Promise<void> {
  const password = await bcrypt.hash(resolveSeedPassword(), 12);

  const office = await prisma.officeLocation.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Kantor BPS Kabupaten Padang Lawas',
      // TODO: konfirmasi koordinat resmi kantor BPS Kab. Padang Lawas (Sibuhuan).
      latitude: 1.0489,
      longitude: 99.7867,
      radius: 100,
    },
  });

  const mentor = await prisma.user.upsert({
    where: { email: 'pembimbing@padanglawas.bps.go.id' },
    update: {},
    create: {
      name: 'Rudi Hartono, S.Stat.',
      email: 'pembimbing@padanglawas.bps.go.id',
      password,
      role: Role.PEMBIMBING,
      noHp: '081234567001',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@padanglawas.bps.go.id' },
    update: {},
    create: {
      name: 'Administrator BPS',
      email: 'admin@padanglawas.bps.go.id',
      password,
      role: Role.ADMIN,
      noHp: '081234567000',
    },
  });

  await prisma.user.upsert({
    where: { email: 'kepala@padanglawas.bps.go.id' },
    update: {},
    create: {
      name: 'Kepala BPS Kabupaten Padang Lawas',
      email: 'kepala@padanglawas.bps.go.id',
      password,
      role: Role.KEPALA_BPS,
      noHp: '081234567002',
    },
  });

  const interns = [
    {
      name: 'Siti Nurhaliza',
      email: 'siti@mahasiswa.ac.id',
      nim: '2021110001',
      asalKampus: 'Universitas Islam Negeri Syekh Ali Hasan Ahmad Addary',
      prodi: 'Statistika',
      noHp: '081234567101',
    },
    {
      name: 'Andi Pratama',
      email: 'andi@mahasiswa.ac.id',
      nim: '2021110002',
      asalKampus: 'Universitas Sumatera Utara',
      prodi: 'Ilmu Komputer',
      noHp: '081234567102',
    },
    {
      name: 'Maya Sari',
      email: 'maya@mahasiswa.ac.id',
      nim: '2021110003',
      asalKampus: 'Universitas Negeri Medan',
      prodi: 'Matematika',
      noHp: '081234567103',
    },
    {
      name: 'Rizky Ramadhan',
      email: 'rizky@mahasiswa.ac.id',
      nim: '2021110004',
      asalKampus: 'Institut Teknologi Del',
      prodi: 'Teknologi Informasi',
      noHp: '081234567104',
    },
    {
      name: 'Dewi Lestari',
      email: 'dewi@mahasiswa.ac.id',
      nim: '2021110005',
      asalKampus: 'Universitas Muhammadiyah Sumatera Utara',
      prodi: 'Sistem Informasi',
      noHp: '081234567105',
    },
    {
      name: 'Fajar Sidiq',
      email: 'fajar@mahasiswa.ac.id',
      nim: '2021110006',
      asalKampus: 'Politeknik Negeri Medan',
      prodi: 'Manajemen Informatika',
      noHp: '081234567106',
    },
  ];

  const now = new Date();
  const periodeMulai = dateOnly(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const periodeSelesai = dateOnly(now.getUTCFullYear(), now.getUTCMonth() + 4, 0);

  const createdInterns = [];
  for (const intern of interns) {
    const user = await prisma.user.upsert({
      where: { email: intern.email },
      update: {},
      create: {
        ...intern,
        password,
        role: Role.MAGANG,
        mentorId: mentor.id,
        periodeMulai,
        periodeSelesai,
      },
    });
    createdInterns.push(user);
  }

  // Absensi dummy untuk bulan berjalan sampai hari ini.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const lastDay = now.getUTCDate();

  for (const intern of createdInterns) {
    for (let day = 1; day <= lastDay; day += 1) {
      const current = dateOnly(year, month, day);
      if (weekend(current)) continue;

      const roll = random();
      if (roll < 0.06) continue; // bolong -> alpha

      const late = random() < 0.22;
      // Jam masuk 07.30 tanpa toleransi: tepat waktu 07.00-07.29, terlambat 07.31-08.19.
      const onTimeMinute = 7 * 60 + Math.floor(random() * 30);
      const lateMinute = 7 * 60 + 31 + Math.floor(random() * 49);
      const checkInMinute = late ? lateMinute : onTimeMinute;

      const checkIn = new Date(current);
      checkIn.setUTCHours(Math.floor(checkInMinute / 60) - 7, checkInMinute % 60, 0, 0);

      const checkOutMinute = 16 * 60 + Math.floor(random() * 30);
      const checkOut = new Date(current);
      checkOut.setUTCHours(Math.floor(checkOutMinute / 60) - 7, checkOutMinute % 60, 0, 0);

      // Hari ini: sebagian pegawai belum check-out.
      const isToday = day === lastDay;
      const hasCheckedOut = !isToday || random() < 0.5;

      await prisma.attendance.upsert({
        where: { userId_date: { userId: intern.id, date: current } },
        update: {},
        create: {
          userId: intern.id,
          date: current,
          checkIn,
          checkOut: hasCheckedOut ? checkOut : null,
          latitudeIn: office.latitude + (random() - 0.5) * 0.0004,
          longitudeIn: office.longitude + (random() - 0.5) * 0.0004,
          latitudeOut: hasCheckedOut ? office.latitude + (random() - 0.5) * 0.0004 : null,
          longitudeOut: hasCheckedOut ? office.longitude + (random() - 0.5) * 0.0004 : null,
          distanceIn: Math.round(random() * 60 * 10) / 10,
          distanceOut: hasCheckedOut ? Math.round(random() * 60 * 10) / 10 : null,
          status: late ? AttendanceStatus.TERLAMBAT : AttendanceStatus.HADIR,
          officeLocationId: office.id,
        },
      });
    }
  }

  // Contoh pengajuan izin (disetujui) dan sakit (menunggu peninjauan).
  const izinStart = dateOnly(year, month, Math.max(lastDay - 3, 1));
  await prisma.leaveRequest.upsert({
    where: { id: '22222222-2222-4222-8222-222222222222' },
    update: {},
    create: {
      id: '22222222-2222-4222-8222-222222222222',
      userId: createdInterns[1].id,
      type: 'IZIN',
      startDate: izinStart,
      endDate: izinStart,
      reason: 'Mengikuti sidang skripsi di kampus.',
      status: 'APPROVED',
      reviewerId: mentor.id,
      reviewedAt: new Date(),
      reviewNote: 'Disetujui, harap melampirkan bukti sidang.',
    },
  });

  await prisma.leaveRequest.upsert({
    where: { id: '33333333-3333-4333-8333-333333333333' },
    update: {},
    create: {
      id: '33333333-3333-4333-8333-333333333333',
      userId: createdInterns[2].id,
      type: 'SAKIT',
      startDate: dateOnly(year, month, lastDay),
      endDate: dateOnly(year, month, lastDay),
      reason: 'Demam, disertai surat keterangan dokter.',
      status: 'PENDING',
    },
  });

  console.info('Seed selesai.');
  console.info(`Akun demo (password sama): ${interns[0].email}, admin@padanglawas.bps.go.id`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'kesalahan tidak diketahui';
    console.error(`Seed gagal: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
