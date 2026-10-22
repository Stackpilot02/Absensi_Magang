import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password wajib diisi.' })
  @MinLength(6, { message: 'Password minimal 6 karakter.' })
  @MaxLength(128)
  password!: string;
}
