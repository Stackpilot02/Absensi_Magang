import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Dian',
    email: 'dian1221@magang.local',
    username: 'dian1221',
    password: 'hash',
    role: Role.MAGANG,
    nim: null,
    asalKampus: 'Sekolah',
    prodi: null,
    noHp: null,
    periodeMulai: null,
    periodeSelesai: null,
    mentorId: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UsersService username', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new UsersService(prisma as never);
  });

  it('menyimpan username dalam huruf kecil saat membuat pengguna', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) => buildUser(data));

    const result = await service.create({
      name: 'Dian',
      email: 'dian1221@magang.local',
      username: 'Dian1221',
      password: 'bps1221',
      role: Role.MAGANG,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'dian1221' }),
      }),
    );
    expect(result.username).toBe('dian1221');
  });

  it('menolak username yang sudah dipakai pengguna lain', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email belum dipakai
      .mockResolvedValueOnce(buildUser({ id: 'user-2' })); // username sudah dipakai

    await expect(
      service.create({
        name: 'Cindy',
        email: 'cindy1221@magang.local',
        username: 'dian1221',
        password: 'bps1221',
        role: Role.MAGANG,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('menolak perubahan username bila sudah dipakai pengguna lain', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(buildUser({ id: 'user-1', username: 'dian1221' }))
      .mockResolvedValueOnce(buildUser({ id: 'user-2', username: 'cindy1221' }));

    await expect(
      service.update('user-1', { username: 'cindy1221' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('mengizinkan username sendiri saat memperbarui data lain', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(buildUser({ id: 'user-1' }));
    prisma.user.update.mockResolvedValue(buildUser({ id: 'user-1', name: 'Dian Baru' }));

    const result = await service.update('user-1', {
      name: 'Dian Baru',
      username: 'dian1221',
    });

    expect(result.name).toBe('Dian Baru');
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });
});
