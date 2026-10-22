import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class HistoryQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'Parameter from harus berformat YYYY-MM-DD.' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Parameter to harus berformat YYYY-MM-DD.' })
  to?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus, { message: 'Status tidak valid.' })
  status?: AttendanceStatus;

  /** Hanya boleh dipakai role admin/pembimbing; pegawai selalu melihat datanya sendiri. */
  @IsOptional()
  @IsUUID('4', { message: 'userId tidak valid.' })
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class SummaryQueryDto {
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

  @IsOptional()
  @IsUUID('4')
  userId?: string;
}

export class AttendanceReportQueryDto {
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

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @IsString()
  format?: 'excel' | 'pdf';
}
