import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Attendance } from '@prisma/client';
import { AttendanceService, AttendanceWithMeta, RecapRow } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { HistoryQueryDto, SummaryQueryDto } from './dto/history-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(201)
  checkIn(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckInDto,
  ): Promise<{ message: string; data: Attendance }> {
    return this.attendanceService.checkIn(user, dto);
  }

  @Post('check-out')
  @HttpCode(200)
  checkOut(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckOutDto,
  ): Promise<{ message: string; data: Attendance }> {
    return this.attendanceService.checkOut(user, dto);
  }

  /** Sekali klik: mencatat jam datang dan pulang dengan waktu server saat ini. */
  @Post('instant')
  @HttpCode(201)
  createInstant(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckInDto,
  ): Promise<{ message: string; data: Attendance }> {
    return this.attendanceService.createInstant(user, dto);
  }

  @Get('today')
  today(@CurrentUser() user: AuthUser): Promise<AttendanceWithMeta | null> {
    return this.attendanceService.findToday(user);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: HistoryQueryDto,
  ): Promise<{
    data: Attendance[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.attendanceService.history(user, query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: SummaryQueryDto): Promise<RecapRow[]> {
    return this.attendanceService.summary(user, query);
  }
}
