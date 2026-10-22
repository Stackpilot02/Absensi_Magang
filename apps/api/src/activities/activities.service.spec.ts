import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActivitiesService } from './activities.service';

const USER = {
  id: 'user-1',
  email: 'siti@mahasiswa.ac.id',
  name: 'Siti',
  role: Role.MAGANG,
  mentorId: null,
};

const MENTOR = {
  id: 'mentor-1',
  email: 'pembimbing@padanglawas.bps.go.id',
  name: 'Pembimbing',
  role: Role.PEMBIMBING,
  mentorId: null,
};

const ADMIN = {
  id: 'admin-1',
  email: 'admin@padanglawas.bps.go.id',
  name: 'Admin',
  role: Role.ADMIN,
  mentorId: null,
};

// Rabu, 21 Oktober 2026 pukul 09:00 WIB
const TODAY = new Date('2026-10-21T02:00:00.000Z');

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prisma: {
    activityReport: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      activityReport: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'act-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'act-1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'act-1' }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-2' }]) },
    };

    service = new ActivitiesService(prisma as never);
    jest.spyOn(service as unknown as { now: () => Date }, 'now').mockReturnValue(TODAY);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('menyimpan laporan dengan tanggal dan uraian yang sudah dirapikan', async () => {
      const result = await service.create(USER, {
        date: '2026-10-21',
        description: '  Merekap data survei lapangan.  ',
      });

      expect(prisma.activityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: USER.id,
            date: new Date('2026-10-21T00:00:00.000Z'),
            description: 'Merekap data survei lapangan.',
          },
        }),
      );
      expect(result.description).toBe('Merekap data survei lapangan.');
    });

    it('menolak tanggal setelah hari ini', async () => {
      await expect(
        service.create(USER, { date: '2026-10-22', description: 'Kegiatan besok.' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.activityReport.create).not.toHaveBeenCalled();
    });

    it('menolak uraian yang terlalu pendek setelah dirapikan', async () => {
      await expect(
        service.create(USER, { date: '2026-10-21', description: '   abc   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('membatasi pegawai magang pada laporan miliknya sendiri', async () => {
      await service.findAll(USER, {});

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.activityReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER.id } }),
      );
    });

    it('menyertakan mahasiswa bimbingan untuk pembimbing', async () => {
      await service.findAll(MENTOR, {});

      expect(prisma.activityReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: [MENTOR.id, 'user-2'] } },
        }),
      );
    });

    it('menerapkan filter tanggal dan pegawai untuk admin', async () => {
      await service.findAll(ADMIN, { from: '2026-10-01', to: '2026-10-21', userId: 'user-9' });

      expect(prisma.activityReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-9',
            date: {
              gte: new Date('2026-10-01T00:00:00.000Z'),
              lte: new Date('2026-10-21T00:00:00.000Z'),
            },
          },
        }),
      );
    });
  });

  describe('update', () => {
    it('menolak perubahan laporan milik orang lain', async () => {
      prisma.activityReport.findUnique.mockResolvedValue({ id: 'act-1', userId: 'user-2' });

      await expect(
        service.update('act-1', USER, { description: 'Perubahan.' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.activityReport.update).not.toHaveBeenCalled();
    });

    it('menolak bila laporan tidak ditemukan', async () => {
      prisma.activityReport.findUnique.mockResolvedValue(null);

      await expect(
        service.update('act-x', USER, { description: 'Perubahan.' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('memperbarui uraian dan tanggal laporan sendiri', async () => {
      prisma.activityReport.findUnique.mockResolvedValue({ id: 'act-1', userId: USER.id });

      await service.update('act-1', USER, {
        date: '2026-10-20',
        description: '  Menyusun rekap baru.  ',
      });

      expect(prisma.activityReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            date: new Date('2026-10-20T00:00:00.000Z'),
            description: 'Menyusun rekap baru.',
          },
        }),
      );
    });

    it('menolak permintaan tanpa perubahan', async () => {
      prisma.activityReport.findUnique.mockResolvedValue({ id: 'act-1', userId: USER.id });

      await expect(service.update('act-1', USER, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('menolak penghapusan laporan milik orang lain', async () => {
      prisma.activityReport.findUnique.mockResolvedValue({ id: 'act-1', userId: 'user-2' });

      await expect(service.remove('act-1', USER)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.activityReport.delete).not.toHaveBeenCalled();
    });

    it('menghapus laporan milik sendiri', async () => {
      prisma.activityReport.findUnique.mockResolvedValue({ id: 'act-1', userId: USER.id });

      const result = await service.remove('act-1', USER);

      expect(prisma.activityReport.delete).toHaveBeenCalledWith({ where: { id: 'act-1' } });
      expect(result.message).toContain('berhasil dihapus');
    });
  });
});
