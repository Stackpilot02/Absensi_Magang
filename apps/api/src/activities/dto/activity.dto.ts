import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateActivityDto {
  /** Tanggal kegiatan (YYYY-MM-DD), tidak boleh melebihi hari ini. */
  @IsDateString({}, { message: 'Tanggal kegiatan harus berformat ISO 8601.' })
  date!: string;

  @IsString()
  @MinLength(5, { message: 'Uraian kegiatan minimal 5 karakter.' })
  @MaxLength(1000, { message: 'Uraian kegiatan maksimal 1000 karakter.' })
  description!: string;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsDateString({}, { message: 'Tanggal kegiatan harus berformat ISO 8601.' })
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Uraian kegiatan minimal 5 karakter.' })
  @MaxLength(1000, { message: 'Uraian kegiatan maksimal 1000 karakter.' })
  description?: string;
}

export class ListActivitiesQueryDto {
  /** Batas awal tanggal (inklusif). */
  @IsOptional()
  @IsDateString({}, { message: 'Tanggal awal harus berformat ISO 8601.' })
  from?: string;

  /** Batas akhir tanggal (inklusif). */
  @IsOptional()
  @IsDateString({}, { message: 'Tanggal akhir harus berformat ISO 8601.' })
  to?: string;

  /** Filter pegawai tertentu (hanya untuk admin/pembimbing/kepala). */
  @IsOptional()
  @IsUUID('4', { message: 'ID pegawai tidak valid.' })
  userId?: string;
}
