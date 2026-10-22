import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';

const OFFICE = {
  id: 'office-1',
  name: 'Kantor BPS Kabupaten Padang Lawas',
  latitude: 1.0601,
  longitude: 99.6644,
  radius: 100,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const INSIDE = { latitude: 1.0601, longitude: 99.6644 };
const OUTSIDE = { latitude: 1.06, longitude: 99.80 };

const USER = {
  id: 'user-1',
  email: 'siti@mahasiswa.ac.id',
  name: 'Siti',
  role: Role.MAGANG,
  mentorId: null,
};

const CONFIG_VALUES: Record<string, unknown> = {
  'attendance.workStartTime': '08:00',
  'attendance.lateToleranceMinutes': 15,
  'attendance.maxClockSkewSeconds': 300,
};

// Rabu, 21 Oktober 2026 pukul 08:10 WIB
const WEDNESDAY_MORNING = new Date('2026-10-21T01:10:00.000Z');

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: {
    attendance: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let officeLocations: { findActive: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      attendance: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'att-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'att-1', ...data })),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: Role.MAGANG,
          periodeMulai: null,
          periodeSelesai: null,
        }),
      },
    };
    officeLocations = { findActive: jest.fn().mockResolvedValue(OFFICE) };
    config = {
      get: jest.fn((key: string) => CONFIG_VALUES[key]),
    };

    service = new AttendanceService(
      prisma as never,
      officeLocations as never,
      config as never,
    );
    jest.spyOn(service as unknown as { now: () => Date }, 'now').mockReturnValue(WEDNESDAY_MORNING);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('check-in berhasil di dalam radius kantor', async () => {
    const result = await service.checkIn(USER, { ...INSIDE });

    expect(result.message).toContain('Check-in berhasil');
    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
    expect(result.data.status).toBe('HADIR');
    expect(result.data.distanceIn).toBe(0);
  });

  it('menolak check-in di luar radius kantor', async () => {
    await expect(service.checkIn(USER, { ...OUTSIDE })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('menolak check-in kedua pada hari yang sama', async () => {
    prisma.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      checkIn: WEDNESDAY_MORNING,
      checkOut: null,
    });

    await expect(service.checkIn(USER, { ...INSIDE })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('menolak check-in pada akhir pekan', async () => {
    jest
      .spyOn(service as unknown as { now: () => Date }, 'now')
      .mockReturnValue(new Date('2026-10-24T01:00:00.000Z'));

    await expect(service.checkIn(USER, { ...INSIDE })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('menolak check-in bila jam perangkat tidak sinkron', async () => {
    await expect(
      service.checkIn(USER, { ...INSIDE, deviceTime: '2026-10-21T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('menerima check-in bila selisih jam perangkat masih wajar', async () => {
    const result = await service.checkIn(USER, {
      ...INSIDE,
      deviceTime: '2026-10-21T01:09:30.000Z',
    });

    expect(result.data.clockSkewIn).toBe(30);
  });

  it('menolak check-out tanpa check-in', async () => {
    await expect(service.checkOut(USER, { ...INSIDE })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('menolak check-out kedua pada hari yang sama', async () => {
    prisma.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      checkIn: WEDNESDAY_MORNING,
      checkOut: WEDNESDAY_MORNING,
    });

    await expect(service.checkOut(USER, { ...INSIDE })).rejects.toBeInstanceOf(ConflictException);
  });

  it('check-out berhasil setelah check-in', async () => {
    prisma.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      checkIn: WEDNESDAY_MORNING,
      checkOut: null,
      note: null,
    });

    const result = await service.checkOut(USER, { ...INSIDE });

    expect(result.message).toContain('Check-out berhasil');
    expect(prisma.attendance.update).toHaveBeenCalledTimes(1);
  });

  describe('kehadiran sekali klik', () => {
    it('mencatat jam datang dan pulang dengan waktu yang sama', async () => {
      const result = await service.createInstant(USER, { ...INSIDE });

      expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
      expect(result.data.checkIn).toEqual(WEDNESDAY_MORNING);
      expect(result.data.checkOut).toEqual(WEDNESDAY_MORNING);
      expect(result.data.status).toBe('HADIR');
      expect(result.data.distanceOut).toBe(0);
      expect(result.data.note).toContain('sekali klik');
      expect(result.message).toContain('pukul');
    });

    it('memakai catatan kustom bila dikirim pengguna', async () => {
      const result = await service.createInstant(USER, { ...INSIDE, note: 'Input susulan.' });

      expect(result.data.note).toBe('Input susulan.');
    });

    it('menolak bila kehadiran hari ini sudah ada', async () => {
      prisma.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        checkIn: WEDNESDAY_MORNING,
        checkOut: null,
      });

      await expect(service.createInstant(USER, { ...INSIDE })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('menolak di luar radius kantor', async () => {
      await expect(service.createInstant(USER, { ...OUTSIDE })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('menolak pada akhir pekan', async () => {
      jest
        .spyOn(service as unknown as { now: () => Date }, 'now')
        .mockReturnValue(new Date('2026-10-24T01:00:00.000Z'));

      await expect(service.createInstant(USER, { ...INSIDE })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('menolak bila jam perangkat tidak sinkron', async () => {
      await expect(
        service.createInstant(USER, { ...INSIDE, deviceTime: '2026-10-21T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('menolak check-in di luar periode magang', async () => {    prisma.user.findUnique.mockResolvedValue({
      role: Role.MAGANG,
      periodeMulai: null,
      periodeSelesai: new Date('2026-09-30T00:00:00.000Z'),
    });

    await expect(service.checkIn(USER, { ...INSIDE })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pegawai magang hanya boleh melihat riwayat sendiri', async () => {
    await expect(service.resolveAccessibleUserIds(USER, 'user-lain')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.resolveAccessibleUserIds(USER)).resolves.toEqual(['user-1']);
  });
});
