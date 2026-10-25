/**
 * Seed akun awal aplikasi Absensi Magang BPS Kabupaten Padang Lawas.
 *
 * Yang dibuat:
 * - 1 kantor (lokasi geofencing),
 * - akun pengelola (admin, pembimbing, kepala),
 * - 7 akun pegawai magang dengan username untuk login.
 *
 * Seed ini TIDAK membuat data absensi, izin, atau laporan kegiatan palsu.
 * Jalankan: npm run db:seed (dari root) atau npm run seed (di apps/api).
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Password default pegawai magang. */
const DEFAULT_MAGANG_PASSWORD = 'bps1221';

function resolveSeedPassword(): string {
  const fromEnv = process.env.SEED_DEFAULT_PASSWORD;
  if (fromEnv && fromEnv.length >= 6) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_DEFAULT_PASSWORD wajib diisi saat menjalankan seed di production.');
  }

  return DEFAULT_MAGANG_PASSWORD;
}

interface SeedIntern {
  name: string;
  username: string;
  asalKampus: 'MagangHub' | 'Sekolah';
}

/** Nama ditulis tanpa gelar agar seragam di seluruh aplikasi. */
const INTERNS: SeedIntern[] = [
  { name: 'Sofi Fauziah Lubis', username: 'sofi1221', asalKampus: 'MagangHub' },
  { name: 'Khotimah Hasibuan', username: 'khotimah1221', asalKampus: 'MagangHub' },
  { name: 'Warida Hafni Hasibuan', username: 'warida1221', asalKampus: 'MagangHub' },
  { name: 'Cut Dila Sari', username: 'cutdila1221', asalKampus: 'MagangHub' },
  { name: 'Jihan Latifah', username: 'jihan1221', asalKampus: 'MagangHub' },
  { name: 'Dian', username: 'dian1221', asalKampus: 'Sekolah' },
  { name: 'Cindy', username: 'cindy1221', asalKampus: 'Sekolah' },
];

/** Email internal; login sehari-hari memakai username. */
function internalEmail(username: string): string {
  return `${username}@magang.local`;
}

async function main(): Promise<void> {
  const password = await bcrypt.hash(resolveSeedPassword(), 12);

  await prisma.officeLocation.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Kantor BPS Kabupaten Padang Lawas',
      // Plus Code 2PRV+8M8 (Sibuhuan) = 1.040788° LU, 99.744119° BT.
      latitude: 1.0407875,
      longitude: 99.7441188,
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

  for (const intern of INTERNS) {
    const email = internalEmail(intern.username);
    await prisma.user.upsert({
      where: { email },
      update: {
        name: intern.name,
        username: intern.username,
        asalKampus: intern.asalKampus,
        mentorId: mentor.id,
      },
      create: {
        name: intern.name,
        email,
        username: intern.username,
        password,
        role: Role.MAGANG,
        asalKampus: intern.asalKampus,
        mentorId: mentor.id,
      },
    });
  }

  console.info('Seed selesai.');
  console.info(`Akun magang: ${INTERNS.map((intern) => intern.username).join(', ')}`);
  console.info('Password magang: (sesuai SEED_DEFAULT_PASSWORD / default bps1221)');
  console.info('Akun pengelola: admin@padanglawas.bps.go.id, pembimbing@..., kepala@...');
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
