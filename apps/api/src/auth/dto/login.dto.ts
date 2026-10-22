import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Email atau username akun. */
  @IsString()
  @IsNotEmpty({ message: 'Email atau username wajib diisi.' })
  @MinLength(3, { message: 'Email atau username minimal 3 karakter.' })
  @MaxLength(150)
  identifier!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password wajib diisi.' })
  @MinLength(6, { message: 'Password minimal 6 karakter.' })
  @MaxLength(128)
  password!: string;
}
