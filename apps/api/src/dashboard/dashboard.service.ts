import { Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OfficeLocationsService } from '../office-locations/office-locations.service';
import { AttendanceService } from '../attendance/attendance.service';
import { dateOnlyToKey, monthRange, toDateOnly } from '../common/time';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface DashboardSummary {
  scope: 'pegawai' | 'pengelola';
  tanggal: string;
  kantor: { name: string; latitude: number; longitude: number; radius: number } | null;
  hariIni: {
    checkIn: string | null;
    checkOut: string | null;
    status: AttendanceStatus | null;
    statusLabel: string | null;
  };
  statistik: Record<string, number>;
  trenMingguan: Array<{ tanggal: string; label: string; hadir: number; terlambat: number }>;
  aktivitasTerakhir: Array<{
    id: string;
    nama: string;
    tanggal: string;
    checkIn: string | null;
    status: AttendanceStatus;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  ALPHA: 'Alpha',
  LIBUR: 'Libur',
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officeLocations: OfficeLocationsService,
    private readonly attendance: AttendanceService,
  ) {}

  private timeLabel(value: Date | null): string | null {
    if (!value) return null;
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(value);
  }

  async summary(requester: AuthUser): Promise<DashboardSummary> {
    const now = new Date();
    const today = toDateOnly(now);

    let office: { name: string; latitude: number; longitude: number; radius: number } | null = null;
    try {
      const found = await this.officeLocations.findActive();
      office = {
        name: found.name,
        latitude: found.latitude,
        longitude: found.longitude,
        radius: found.radius,
      };
    } catch {
      office = null;
    }

    const isPengelola =
      requester.role === Role.ADMIN ||
      requester.role === Role.KEPALA_BPS ||
      requester.role === Role.PEMBIMBING;

    if (isPengelola) {
      const scopeIds =
        requester.role === Role.PEMBIMBING
          ? await this.attendance.resolveAccessibleUserIds(requester)
          : null;

      const userFilter: Prisma.UserWhereInput = {
        role: Role.MAGANG,
        isActive: true,
        ...(scopeIds ? { id: { in: scopeIds } } : {}),
      };

      const [totalPeserta, attendancesToday, leavesToday] = await this.prisma.$transaction([
        this.prisma.user.count({ where: userFilter }),
        this.prisma.attendance.findMany({
          where: {
            date: today,
            ...(scopeIds ? { userId: { in: scopeIds } } : {}),
          },
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            status: 'APPROVED',
            startDate: { lte: today },
            endDate: { gte: today },
            ...(scopeIds ? { userId: { in: scopeIds } } : {}),
          },
        }),
      ]);

      const hadir = attendancesToday.filter((item) => item.status === 'HADIR').length;
      const terlambat = attendancesToday.filter((item) => item.status === 'TERLAMBAT').length;
      const izinSakit = new Set(leavesToday.map((leave) => leave.userId)).size;
      const belumAbsen = Math.max(totalPeserta - hadir - terlambat - izinSakit, 0);

      return {
        scope: 'pengelola',
        tanggal: dateOnlyToKey(today),
        kantor: office,
        hariIni: { checkIn: null, checkOut: null, status: null, statusLabel: null },
        statistik: {
          totalPeserta,
          hadir,
          terlambat,
          izinSakit,
          belumAbsen,
          persentaseKehadiran:
            totalPeserta > 0 ? Math.round(((hadir + terlambat) / totalPeserta) * 1000) / 10 : 0,
        },
        trenMingguan: await this.buildWeeklyTrend(scopeIds),
        aktivitasTerakhir: await this.buildRecentActivity(scopeIds),
      };
    }

    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const [todayAttendance, recap, recent] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { userId_date: { userId: requester.id, date: today } },
      }),
      this.attendance.buildRecap([requester.id], year, month),
      this.prisma.attendance.findMany({
        where: { userId: requester.id },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    const row = recap[0];

    return {
      scope: 'pegawai',
      tanggal: dateOnlyToKey(today),
      kantor: office,
      hariIni: {
        checkIn: this.timeLabel(todayAttendance?.checkIn ?? null),
        checkOut: this.timeLabel(todayAttendance?.checkOut ?? null),
        status: todayAttendance?.status ?? null,
        statusLabel: todayAttendance ? STATUS_LABEL[todayAttendance.status] : null,
      },
      statistik: {
        hadir: row?.hadir ?? 0,
        terlambat: row?.terlambat ?? 0,
        izin: row?.izin ?? 0,
        sakit: row?.sakit ?? 0,
        alpha: row?.alpha ?? 0,
        hariKerja: row?.totalHariKerja ?? 0,
        persentaseKehadiran: row?.persentaseKehadiran ?? 0,
        bulan: month,
        tahun: year,
      },
      trenMingguan: await this.buildWeeklyTrend([requester.id]),
      aktivitasTerakhir: recent.map((item) => ({
        id: item.id,
        nama: requester.name,
        tanggal: dateOnlyToKey(item.date),
        checkIn: this.timeLabel(item.checkIn),
        status: item.status,
      })),
    };
  }

  private async buildWeeklyTrend(userIds: string[] | null) {
    const today = toDateOnly(new Date());
    const days: Array<{ tanggal: string; label: string; hadir: number; terlambat: number }> = [];

    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: today },
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
      select: { date: true, status: true },
    });

    for (let offset = 0; offset < 7; offset += 1) {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + offset);
      const key = dateOnlyToKey(current);
      const items = attendances.filter((item) => dateOnlyToKey(item.date) === key);

      days.push({
        tanggal: key,
        label: new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short' }).format(
          current,
        ),
        hadir: items.filter((item) => item.status === 'HADIR').length,
        terlambat: items.filter((item) => item.status === 'TERLAMBAT').length,
      });
    }

    return days;
  }

  private async buildRecentActivity(userIds: string[] | null) {
    const items = await this.prisma.attendance.findMany({
      where: userIds ? { userId: { in: userIds } } : {},
      include: { user: { select: { name: true } } },
      orderBy: [{ date: 'desc' }, { checkIn: 'desc' }],
      take: 8,
    });

    return items.map((item) => ({
      id: item.id,
      nama: item.user.name,
      tanggal: dateOnlyToKey(item.date),
      checkIn: this.timeLabel(item.checkIn),
      status: item.status,
    }));
  }

  /** Rekap statistik satu bulan penuh (dipakai halaman Laporan). */
  async monthly(requester: AuthUser, year: number, month: number) {
    const userIds = await this.attendance.resolveAccessibleUserIds(requester);
    const { start, end } = monthRange(year, month);

    const [recap, totalHari] = await Promise.all([
      this.attendance.buildRecap(userIds, year, month),
      Promise.resolve(end.getUTCDate()),
    ]);

    return { periode: { year, month, totalHari }, data: recap };
  }
}
