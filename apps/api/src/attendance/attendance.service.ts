import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Attendance, AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OfficeLocationsService } from '../office-locations/office-locations.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { HistoryQueryDto, SummaryQueryDto } from './dto/history-query.dto';
import {
  computeAttendanceStatus,
  evaluateClockSkew,
  isWeekend,
  parseTimeToMinutes,
  resolveDailyStatus,
  WorkSchedule,
  ATTENDANCE_STATUS_LABEL,
} from '../common/attendance-status';
import {
  haversineDistanceMeters,
  isWithinRadius,
  roundMeters,
} from '../common/geo';
import {
  dateOnlyToKey,
  jakartaMinutesOfDay,
  monthRange,
  toDateOnly,
} from '../common/time';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface AttendanceWithMeta extends Attendance {
  distanceMeters: number | null;
}

export interface RecapRow {
  userId: string;
  name: string;
  nim: string | null;
  asalKampus: string | null;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpha: number;
  libur: number;
  totalHariKerja: number;
  persentaseKehadiran: number;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly officeLocations: OfficeLocationsService,
    private readonly config: ConfigService,
  ) {}

  private get schedule(): WorkSchedule {
    return {
      workStartTime: this.config.get<string>('attendance.workStartTime') as string,
      lateToleranceMinutes: this.config.get<number>('attendance.lateToleranceMinutes') as number,
    };
  }

  private get maxClockSkewSeconds(): number {
    return this.config.get<number>('attendance.maxClockSkewSeconds') as number;
  }

  /** Sumber waktu server; dipisah agar mudah diuji. */
  protected now(): Date {
    return new Date();
  }

  /** Validasi jam perangkat & simpan besaran selisih untuk audit. */
  private assertClockTrusted(deviceTime: string | undefined, serverNow: Date): number {
    const { skewSeconds, suspicious } = evaluateClockSkew(
      serverNow,
      deviceTime,
      this.maxClockSkewSeconds,
    );

    if (suspicious) {
      throw new BadRequestException(
        'Waktu perangkat tidak sinkron dengan server. Aktifkan pengaturan waktu otomatis lalu coba lagi.',
      );
    }

    return skewSeconds;
  }

  /** Validasi posisi terhadap radius kantor; mengembalikan jarak & lokasi kantor. */
  private async assertWithinOfficeRadius(point: { latitude: number; longitude: number }) {
    const office = await this.officeLocations.findActive();
    const distance = haversineDistanceMeters(point, {
      latitude: office.latitude,
      longitude: office.longitude,
    });

    if (!isWithinRadius(point, office, office.radius)) {
      throw new ForbiddenException(
        `Anda berada ${Math.round(distance)} meter dari ${office.name}. ` +
          `Absensi hanya dapat dilakukan dalam radius ${office.radius} meter.`,
      );
    }

    return { office, distance: roundMeters(distance) };
  }

  private async assertPeriodeMagang(userId: string, now: Date): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, periodeMulai: true, periodeSelesai: true },
    });

    if (!user || user.role !== Role.MAGANG) return;

    const today = toDateOnly(now);
    if (user.periodeMulai && today < user.periodeMulai) {
      throw new ForbiddenException('Periode magang Anda belum dimulai.');
    }
    if (user.periodeSelesai && today > user.periodeSelesai) {
      throw new ForbiddenException('Periode magang Anda sudah berakhir.');
    }
  }

  async checkIn(requester: AuthUser, dto: CheckInDto): Promise<{ message: string; data: Attendance }> {
    const now = this.now();

    if (isWeekend(now)) {
      throw new BadRequestException('Hari ini hari libur kantor. Absensi tidak diperlukan.');
    }

    const skewSeconds = this.assertClockTrusted(dto.deviceTime, now);
    await this.assertPeriodeMagang(requester.id, now);

    const today = toDateOnly(now);
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId: requester.id, date: today } },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Anda sudah melakukan check-in hari ini.');
    }

    const { office, distance } = await this.assertWithinOfficeRadius(dto);
    const status = computeAttendanceStatus(now, this.schedule);

    const attendance = await this.prisma.attendance.create({
      data: {
        userId: requester.id,
        date: today,
        checkIn: now,
        latitudeIn: dto.latitude,
        longitudeIn: dto.longitude,
        distanceIn: distance,
        clockSkewIn: skewSeconds,
        status,
        note: dto.note,
        officeLocationId: office.id,
      },
    });

    this.logger.log(`Check-in tercatat untuk user ${requester.id} (${status}, ${distance} m)`);

    return {
      message:
        status === 'HADIR'
          ? 'Check-in berhasil. Selamat bekerja!'
          : 'Check-in berhasil, namun Anda tercatat terlambat.',
      data: attendance,
    };
  }

  async checkOut(
    requester: AuthUser,
    dto: CheckOutDto,
  ): Promise<{ message: string; data: Attendance }> {
    const now = this.now();
    const skewSeconds = this.assertClockTrusted(dto.deviceTime, now);

    const today = toDateOnly(now);
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId: requester.id, date: today } },
    });

    if (!existing?.checkIn) {
      throw new BadRequestException('Anda belum melakukan check-in hari ini.');
    }
    if (existing.checkOut) {
      throw new ConflictException('Anda sudah melakukan check-out hari ini.');
    }

    // Absen pulang baru dibuka pada jam pulang kantor agar tidak ada pulang lebih awal.
    const workEndTime = this.config.get<string>('attendance.workEndTime') as string;
    if (jakartaMinutesOfDay(now) < parseTimeToMinutes(workEndTime)) {
      throw new BadRequestException(
        `Absen pulang baru dapat dilakukan mulai pukul ${workEndTime} WIB.`,
      );
    }

    const { distance } = await this.assertWithinOfficeRadius(dto);

    const attendance = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        latitudeOut: dto.latitude,
        longitudeOut: dto.longitude,
        distanceOut: distance,
        clockSkewOut: skewSeconds,
        note: dto.note ?? existing.note,
      },
    });

    return { message: 'Check-out berhasil. Terima kasih atas kerja hari ini!', data: attendance };
  }

  async findToday(requester: AuthUser): Promise<AttendanceWithMeta | null> {
    const today = toDateOnly(this.now());
    const attendance = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId: requester.id, date: today } },
    });

    return attendance ? { ...attendance, distanceMeters: attendance.distanceIn } : null;
  }

  /** Menentukan batas data yang boleh diakses sesuai role. */
  async resolveAccessibleUserIds(
    requester: AuthUser,
    requestedUserId?: string,
  ): Promise<string[] | null> {
    if (requester.role === Role.ADMIN || requester.role === Role.KEPALA_BPS) {
      return requestedUserId ? [requestedUserId] : null;
    }

    if (requester.role === Role.PEMBIMBING) {
      const mentees = await this.prisma.user.findMany({
        where: { mentorId: requester.id },
        select: { id: true },
      });
      const allowed = new Set([requester.id, ...mentees.map((m) => m.id)]);

      if (requestedUserId && !allowed.has(requestedUserId)) {
        throw new ForbiddenException('Anda tidak membimbing pengguna tersebut.');
      }

      return requestedUserId ? [requestedUserId] : [...allowed];
    }

    if (requestedUserId && requestedUserId !== requester.id) {
      throw new ForbiddenException('Anda hanya dapat melihat riwayat absensi sendiri.');
    }

    return [requester.id];
  }

  async history(
    requester: AuthUser,
    query: HistoryQueryDto,
  ): Promise<{
    data: Attendance[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const userIds = await this.resolveAccessibleUserIds(requester, query.userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = {
      ...(userIds ? { userId: { in: userIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, nim: true, asalKampus: true } },
        },
        orderBy: [{ date: 'desc' }, { checkIn: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async summary(requester: AuthUser, query: SummaryQueryDto): Promise<RecapRow[]> {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;

    const userIds = await this.resolveAccessibleUserIds(requester, query.userId);
    return this.buildRecap(userIds, year, month);
  }

  /** Rekap kehadiran per pengguna pada satu bulan. */
  async buildRecap(
    userIds: string[] | null,
    year: number,
    month: number,
  ): Promise<RecapRow[]> {
    const { start, end } = monthRange(year, month);

    const users = await this.prisma.user.findMany({
      where: {
        role: Role.MAGANG,
        ...(userIds ? { id: { in: userIds } } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nim: true, asalKampus: true },
    });

    const userIdList = users.map((user) => user.id);
    if (userIdList.length === 0) return [];

    const [attendances, leaves] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where: { userId: { in: userIdList }, date: { gte: start, lte: end } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: { in: userIdList },
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        },
      }),
    ]);

    const attendanceByUser = new Map<string, Map<string, Attendance>>();
    for (const item of attendances) {
      const key = dateOnlyToKey(item.date);
      if (!attendanceByUser.has(item.userId)) attendanceByUser.set(item.userId, new Map());
      attendanceByUser.get(item.userId)?.set(key, item);
    }

    return users.map((user) => {
      const rows = attendanceByUser.get(user.id) ?? new Map<string, Attendance>();
      const userLeaves = leaves.filter((leave) => leave.userId === user.id);
      const recap: RecapRow = {
        userId: user.id,
        name: user.name,
        nim: user.nim,
        asalKampus: user.asalKampus,
        hadir: 0,
        terlambat: 0,
        izin: 0,
        sakit: 0,
        alpha: 0,
        libur: 0,
        totalHariKerja: 0,
        persentaseKehadiran: 0,
      };

      for (let day = 1; day <= end.getUTCDate(); day += 1) {
        const current = new Date(Date.UTC(year, month - 1, day));
        const key = dateOnlyToKey(current);
        const attendance = rows.get(key);
        const approvedLeave = userLeaves.find(
          (leave) =>
            dateOnlyToKey(leave.startDate) <= key && dateOnlyToKey(leave.endDate) >= key,
        );

        const status = resolveDailyStatus({
          date: current,
          attendanceStatus: attendance?.status ?? null,
          approvedLeave: approvedLeave?.type ?? null,
        });

        if (status === 'LIBUR') {
          recap.libur += 1;
          continue;
        }

        recap.totalHariKerja += 1;
        if (status === 'HADIR') recap.hadir += 1;
        if (status === 'TERLAMBAT') recap.terlambat += 1;
        if (status === 'IZIN') recap.izin += 1;
        if (status === 'SAKIT') recap.sakit += 1;
        if (status === 'ALPHA') recap.alpha += 1;
      }

      recap.persentaseKehadiran =
        recap.totalHariKerja > 0
          ? Math.round(((recap.hadir + recap.terlambat) / recap.totalHariKerja) * 1000) / 10
          : 0;

      return recap;
    });
  }

  /** Detail harian seorang pengguna (untuk laporan PDF/Excel). */
  async buildDailyDetail(
    userId: string,
    year: number,
    month: number,
  ): Promise<
    Array<{
      tanggal: string;
      hari: string;
      masuk: string | null;
      keluar: string | null;
      status: AttendanceStatus;
      statusLabel: string;
      keterangan: string | null;
    }>
  > {
    const { start, end } = monthRange(year, month);
    const [attendances, leaves, user] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where: { userId, date: { gte: start, lte: end } },
      }),
      this.prisma.leaveRequest.findMany({
        where: { userId, status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ]);

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    const byDate = new Map(attendances.map((item) => [dateOnlyToKey(item.date), item]));

    const formatTime = (value: Date | null): string | null =>
      value
        ? new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(value)
        : null;

    const result = [];
    for (let day = 1; day <= end.getUTCDate(); day += 1) {
      const current = new Date(Date.UTC(year, month - 1, day));
      const key = dateOnlyToKey(current);
      const attendance = byDate.get(key);
      const approvedLeave = leaves.find(
        (leave) => dateOnlyToKey(leave.startDate) <= key && dateOnlyToKey(leave.endDate) >= key,
      );

      const status = resolveDailyStatus({
        date: current,
        attendanceStatus: attendance?.status ?? null,
        approvedLeave: approvedLeave?.type ?? null,
      });

      result.push({
        tanggal: key,
        hari: new Intl.DateTimeFormat('id-ID', {
          timeZone: 'UTC',
          weekday: 'long',
        }).format(current),
        masuk: formatTime(attendance?.checkIn ?? null),
        keluar: formatTime(attendance?.checkOut ?? null),
        status,
        statusLabel: ATTENDANCE_STATUS_LABEL[status],
        keterangan: approvedLeave?.reason ?? attendance?.note ?? null,
      });
    }

    return result;
  }
}
