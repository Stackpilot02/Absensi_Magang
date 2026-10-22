import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AttendanceReportQueryDto } from '../attendance/dto/history-query.dto';
import { AttendanceService } from '../attendance/attendance.service';
import { OfficeLocationsService } from '../office-locations/office-locations.service';
import { ReportData, ReportUserDetail, periodLabel } from './report.types';
import { buildRecapExcel } from './excel.generator';
import { buildRecapPdf } from './pdf.generator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface GeneratedReport {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly officeLocations: OfficeLocationsService,
  ) {}

  async buildReportData(
    requester: AuthUser,
    query: AttendanceReportQueryDto,
  ): Promise<ReportData> {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;

    const userIds = await this.attendance.resolveAccessibleUserIds(requester, query.userId);

    if (requester.role === Role.MAGANG && query.userId && query.userId !== requester.id) {
      throw new ForbiddenException('Anda hanya dapat mengunduh laporan pribadi.');
    }

    const recap = await this.attendance.buildRecap(userIds, year, month);

    let officeName = 'Kantor BPS Kabupaten Padang Lawas';
    try {
      const office = await this.officeLocations.findActive();
      officeName = office.name;
    } catch {
      // Lokasi belum dikonfigurasi; laporan tetap bisa dicetak dengan nama default.
    }

    const details: ReportUserDetail[] = [];
    for (const row of recap) {
      const user = await this.prisma.user.findUnique({
        where: { id: row.userId },
        select: { name: true, nim: true, asalKampus: true, prodi: true },
      });
      if (!user) {
        throw new NotFoundException(`Data pengguna ${row.userId} tidak ditemukan.`);
      }

      details.push({
        userId: row.userId,
        name: user.name,
        nim: user.nim,
        asalKampus: user.asalKampus,
        prodi: user.prodi,
        rows: await this.attendance.buildDailyDetail(row.userId, year, month),
      });
    }

    return {
      officeName,
      generatedAt: now,
      generatedBy: requester.name,
      month,
      year,
      recap,
      details,
    };
  }

  async generate(
    requester: AuthUser,
    query: AttendanceReportQueryDto,
    format: 'excel' | 'pdf',
  ): Promise<GeneratedReport> {
    const data = await this.buildReportData(requester, query);
    const slug = `laporan-absensi-${periodLabel(data.month, data.year)
      .toLowerCase()
      .replace(/\s+/g, '-')}`;

    if (format === 'pdf') {
      return {
        buffer: await buildRecapPdf(data),
        filename: `${slug}.pdf`,
        contentType: 'application/pdf',
      };
    }

    return {
      buffer: await buildRecapExcel(data),
      filename: `${slug}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
