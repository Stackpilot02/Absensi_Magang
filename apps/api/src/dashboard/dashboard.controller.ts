import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { DashboardService, DashboardSummary } from './dashboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

class MonthlyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser): Promise<DashboardSummary> {
    return this.dashboardService.summary(user);
  }

  @Get('monthly')
  @Roles(Role.ADMIN, Role.PEMBIMBING, Role.KEPALA_BPS)
  monthly(@CurrentUser() user: AuthUser, @Query() query: MonthlyQueryDto) {
    const now = new Date();
    return this.dashboardService.monthly(
      user,
      query.year ?? now.getFullYear(),
      query.month ?? now.getMonth() + 1,
    );
  }
}
