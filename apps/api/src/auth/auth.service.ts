import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  nim: string | null;
  asalKampus: string | null;
  prodi: string | null;
  noHp: string | null;
  periodeMulai: Date | null;
  periodeSelesai: Date | null;
  mentorId: string | null;
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
  name: string;
}

/** Membuang data sensitif sebelum dikirim ke klien. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    nim: user.nim,
    asalKampus: user.asalKampus,
    prodi: user.prodi,
    noHp: user.noHp,
    periodeMulai: user.periodeMulai,
    periodeSelesai: user.periodeSelesai,
    mentorId: user.mentorId,
    isActive: user.isActive,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Verifikasi kredensial; mengembalikan user bila valid. */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Pesan error disamakan agar tidak membocorkan email mana yang terdaftar.
    if (!user) {
      throw new UnauthorizedException('Email atau password salah.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif. Hubungi admin BPS.');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    return user;
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.validateCredentials(dto.email, dto.password);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = await this.jwt.signAsync(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { accessToken, user: toPublicUser(user) };
  }

  async findActiveUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new NotFoundException('Pengguna tidak ditemukan atau tidak aktif.');
    }
    return toPublicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    const valid = await bcrypt.compare(dto.passwordLama, user.password);
    if (!valid) {
      throw new UnauthorizedException('Password lama tidak sesuai.');
    }

    const hashed = await bcrypt.hash(dto.passwordBaru, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return { message: 'Password berhasil diperbarui.' };
  }
}
