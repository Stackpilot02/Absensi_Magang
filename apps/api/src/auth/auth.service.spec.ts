import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const PASSWORD = 'Rahasia123';

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Siti Nurhaliza',
    email: 'siti@mahasiswa.ac.id',
    password: bcrypt.hashSync(PASSWORD, 4),
    role: Role.MAGANG,
    nim: '2021110001',
    asalKampus: 'UIN',
    prodi: 'Statistika',
    noHp: '081234567101',
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

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token-abc') };
    service = new AuthService(prisma as never, jwt as never);
  });

  it('login berhasil mengembalikan token dan profil tanpa password', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser());

    const result = await service.login({ identifier: 'siti@mahasiswa.ac.id', password: PASSWORD });

    expect(result.accessToken).toBe('token-abc');
    expect(result.user).not.toHaveProperty('password');
    expect(result.user.email).toBe('siti@mahasiswa.ac.id');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', email: 'siti@mahasiswa.ac.id' }),
    );
  });

  it('email dinormalisasi menjadi huruf kecil saat pencarian', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser());

    await service.login({ identifier: 'SITI@Mahasiswa.ac.id', password: PASSWORD });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'siti@mahasiswa.ac.id' }, { username: 'siti@mahasiswa.ac.id' }] },
    });
  });

  it('login memakai username juga dapat dilakukan', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser({ username: 'siti1221' }));

    const result = await service.login({ identifier: 'Siti1221', password: PASSWORD });

    expect(result.user.username).toBe('siti1221');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'siti1221' }, { username: 'siti1221' }] },
    });
  });

  it('menolak password yang salah', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser());

    await expect(
      service.login({ identifier: 'siti@mahasiswa.ac.id', password: 'PasswordSalah1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('menolak email yang tidak terdaftar', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ identifier: 'tidakada@mail.id', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('menolak akun yang tidak aktif', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser({ isActive: false }));

    await expect(
      service.login({ identifier: 'siti@mahasiswa.ac.id', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('menolak ganti password bila password lama salah', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUser());

    await expect(
      service.changePassword('user-1', {
        passwordLama: 'SalahSekali1',
        passwordBaru: 'PasswordBaru1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('menyimpan password baru dalam bentuk hash', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUser());

    await service.changePassword('user-1', {
      passwordLama: PASSWORD,
      passwordBaru: 'PasswordBaru1',
    });

    const stored = prisma.user.update.mock.calls[0][0].data.password as string;
    expect(stored).not.toBe('PasswordBaru1');
    expect(bcrypt.compareSync('PasswordBaru1', stored)).toBe(true);
  });
});
