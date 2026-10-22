import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toDateOnly } from '../common/time';
import {
  CreateActivityDto,
  ListActivitiesQueryDto,
  UpdateActivityDto,
} from './dto/activity.dto';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const USER_SELECT = { id: true, name: true, nim: true, role: true } as const;

type ActivityWithUser = Prisma.ActivityReportGetPayload<{
  include: { user: { select: typeof USER_SELECT } };
}>;

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Waktu sekarang; dipisah agar mudah diuji. */
  private now(): Date {
    return new Date();
  }

  /** Mengubah string tanggal menjadi kolom `@db.Date` (tengah malam UTC). */
  private parseDate(value: string): Date {
    const key = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      throw new BadRequestException('Tanggal kegiatan tidak valid.');
    }
    const date = new Date(`${key}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Tanggal kegiatan tidak valid.');
    }
    return date;
  }

  private assertNotFuture(date: Date): void {
    if (date > toDateOnly(this.now())) {
      throw new BadRequestException('Tanggal kegiatan tidak boleh melebihi hari ini.');
    }
  }

  private normalizeDescription(value: string): string {
    const description = value.trim();
    if (description.length < 5) {
      throw new BadRequestException('Uraian kegiatan minimal 5 karakter.');
    }
    return description;
  }

  async create(requester: AuthUser, dto: CreateActivityDto): Promise<ActivityWithUser> {
    const date = this.parseDate(dto.date);
    this.assertNotFuture(date);

    return this.prisma.activityReport.create({
      data: {
        userId: requester.id,
        date,
        description: this.normalizeDescription(dto.description),
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  /**
   * Daftar laporan kegiatan sesuai peran:
   * - MAGANG hanya melihat laporannya sendiri,
   * - PEMBIMBING melihat laporan dirinya dan mahasiswa bimbingannya,
   * - ADMIN/KEPALA_BPS melihat seluruh laporan (dapat difilter per pegawai).
   */
  async findAll(
    requester: AuthUser,
    query: ListActivitiesQueryDto,
  ): Promise<ActivityWithUser[]> {
    const where: Prisma.ActivityReportWhereInput = {};

    if (requester.role === Role.MAGANG) {
      where.userId = requester.id;
    } else if (requester.role === Role.PEMBIMBING) {
      const mentees = await this.prisma.user.findMany({
        where: { mentorId: requester.id },
        select: { id: true },
      });
      where.userId = { in: [requester.id, ...mentees.map((mentee) => mentee.id)] };
    } else if (query.userId) {
      where.userId = query.userId;
    }

    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: this.parseDate(query.from) } : {}),
        ...(query.to ? { lte: this.parseDate(query.to) } : {}),
      };
    }

    return this.prisma.activityReport.findMany({
      where,
      include: { user: { select: USER_SELECT } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async update(
    id: string,
    requester: AuthUser,
    dto: UpdateActivityDto,
  ): Promise<ActivityWithUser> {
    const existing = await this.prisma.activityReport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Laporan kegiatan tidak ditemukan.');
    }
    if (existing.userId !== requester.id) {
      throw new ForbiddenException('Anda hanya dapat mengubah laporan kegiatan milik sendiri.');
    }

    const data: { date?: Date; description?: string } = {};
    if (dto.date !== undefined) {
      const date = this.parseDate(dto.date);
      this.assertNotFuture(date);
      data.date = date;
    }
    if (dto.description !== undefined) {
      data.description = this.normalizeDescription(dto.description);
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Tidak ada perubahan yang dikirim.');
    }

    return this.prisma.activityReport.update({
      where: { id },
      data,
      include: { user: { select: USER_SELECT } },
    });
  }

  async remove(id: string, requester: AuthUser): Promise<{ message: string }> {
    const existing = await this.prisma.activityReport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Laporan kegiatan tidak ditemukan.');
    }
    if (existing.userId !== requester.id) {
      throw new ForbiddenException('Anda hanya dapat menghapus laporan kegiatan milik sendiri.');
    }

    await this.prisma.activityReport.delete({ where: { id } });
    return { message: 'Laporan kegiatan berhasil dihapus.' };
  }
}
