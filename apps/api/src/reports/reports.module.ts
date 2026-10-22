import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { OfficeLocationsModule } from '../office-locations/office-locations.module';

@Module({
  imports: [AttendanceModule, OfficeLocationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
