import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { toPublicUser, PublicUser } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-user.dto';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListUsersQueryDto): Promise<PaginatedResult<PublicUser>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.UserWhereInput = {};

    if (query.role) where.role = query.role;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { nim: { contains: search, mode: 'insensitive' } },
        { asalKampus: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: users.map(toPublicUser),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: string, requester: AuthUser): Promise<PublicUser> {
    if (requester.role === Role.MAGANG && requester.id !== id) {
      throw new ForbiddenException('Anda hanya dapat melihat data diri sendiri.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }
    return toPublicUser(user);
  }

  /** Daftar peserta magang yang dibimbing (untuk role PEMBIMBING). */
  async findMentees(mentorId: string): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      where: { mentorId, role: Role.MAGANG },
      orderBy: { name: 'asc' },
    });
    return users.map(toPublicUser);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const email = dto.email.toLowerCase();
    const username = this.normalizeUsername(dto.username);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }
    if (username) {
      const usernameExists = await this.prisma.user.findUnique({ where: { username } });
      if (usernameExists) {
        throw new ConflictException('Username sudah digunakan.');
      }
    }
    if (dto.nim) {
      const nimExists = await this.prisma.user.findUnique({ where: { nim: dto.nim } });
      if (nimExists) {
        throw new ConflictException('NIM sudah terdaftar.');
      }
    }
    this.assertPeriodeValid(dto.periodeMulai, dto.periodeSelesai);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        username,
        password: await bcrypt.hash(dto.password, 12),
        role: dto.role,
        nim: dto.nim,
        asalKampus: dto.asalKampus,
        prodi: dto.prodi,
        noHp: dto.noHp,
        periodeMulai: dto.periodeMulai ? new Date(dto.periodeMulai) : null,
        periodeSelesai: dto.periodeSelesai ? new Date(dto.periodeSelesai) : null,
        mentorId: dto.mentorId,
      },
    });

    return toPublicUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (emailTaken) {
        throw new ConflictException('Email sudah terdaftar.');
      }
    }

    if (dto.nim && dto.nim !== existing.nim) {
      const nimTaken = await this.prisma.user.findUnique({ where: { nim: dto.nim } });
      if (nimTaken) {
        throw new ConflictException('NIM sudah terdaftar.');
      }
    }

    const username = this.normalizeUsername(dto.username);
    if (username && username !== existing.username) {
      const usernameTaken = await this.prisma.user.findUnique({ where: { username } });
      if (usernameTaken) {
        throw new ConflictException('Username sudah digunakan.');
      }
    }

    this.assertPeriodeValid(
      dto.periodeMulai ?? existing.periodeMulai?.toISOString(),
      dto.periodeSelesai ?? existing.periodeSelesai?.toISOString(),
    );

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email?.toLowerCase(),
        username,
        role: dto.role,
        nim: dto.nim,
        asalKampus: dto.asalKampus,
        prodi: dto.prodi,
        noHp: dto.noHp,
        periodeMulai: dto.periodeMulai ? new Date(dto.periodeMulai) : undefined,
        periodeSelesai: dto.periodeSelesai ? new Date(dto.periodeSelesai) : undefined,
        mentorId: dto.mentorId,
        isActive: dto.isActive,
        password: dto.password ? await bcrypt.hash(dto.password, 12) : undefined,
      },
    });

    return toPublicUser(user);
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    return toPublicUser(user);
  }

  /** Nonaktifkan akun (soft delete) agar histori absensi tetap utuh. */
  async deactivate(id: string): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { message: 'Akun berhasil dinonaktifkan.' };
  }

  private normalizeUsername(value?: string): string | undefined {
    const trimmed = value?.trim().toLowerCase();
    return trimmed ? trimmed : undefined;
  }

  private assertPeriodeValid(mulai?: string, selesai?: string): void {
    if (mulai && selesai && new Date(selesai) < new Date(mulai)) {
      throw new ConflictException('Tanggal selesai magang tidak boleh sebelum tanggal mulai.');
    }
  }
}
