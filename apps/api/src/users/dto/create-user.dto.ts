import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama wajib diisi.' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Format email tidak valid.' })
  @MaxLength(150)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf dan angka.',
  })
  password!: string;

  @IsEnum(Role, { message: 'Role tidak valid.' })
  role!: Role;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  asalKampus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  prodi?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+62|62|0)[0-9]{8,13}$/, { message: 'Nomor HP tidak valid.' })
  noHp?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Tanggal mulai harus berformat ISO 8601.' })
  periodeMulai?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Tanggal selesai harus berformat ISO 8601.' })
  periodeSelesai?: string;

  @IsOptional()
  @IsString()
  mentorId?: string;
}
