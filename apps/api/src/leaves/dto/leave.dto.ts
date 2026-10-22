import { LeaveStatus, LeaveType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeaveDto {
  @IsEnum(LeaveType, { message: 'Jenis pengajuan harus IZIN atau SAKIT.' })
  type!: LeaveType;

  @IsDateString({}, { message: 'Tanggal mulai harus berformat ISO 8601.' })
  startDate!: string;

  @IsDateString({}, { message: 'Tanggal selesai harus berformat ISO 8601.' })
  endDate!: string;

  @IsString()
  @IsNotEmpty({ message: 'Alasan wajib diisi.' })
  @MaxLength(500)
  reason!: string;
}

export class ReviewLeaveDto {
  @IsEnum(LeaveStatus, { message: 'Status peninjauan tidak valid.' })
  status!: LeaveStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
