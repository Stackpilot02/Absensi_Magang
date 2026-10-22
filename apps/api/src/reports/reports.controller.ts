import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { AttendanceReportQueryDto } from '../attendance/dto/history-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('reports')
@Roles(Role.ADMIN, Role.PEMBIMBING, Role.KEPALA_BPS, Role.MAGANG)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('excel')
  async excel(
    @CurrentUser() user: AuthUser,
    @Query() query: AttendanceReportQueryDto,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.generate(user, query, 'excel');
    return new StreamableFile(report.buffer, {
      type: report.contentType,
      disposition: `attachment; filename="${report.filename}"`,
    });
  }

  @Get('pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Query() query: AttendanceReportQueryDto,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.generate(user, query, 'pdf');
    return new StreamableFile(report.buffer, {
      type: report.contentType,
      disposition: `attachment; filename="${report.filename}"`,
    });
  }
}
