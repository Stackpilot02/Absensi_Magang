import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { OfficeLocationsModule } from '../office-locations/office-locations.module';

@Module({
  imports: [AttendanceModule, OfficeLocationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
