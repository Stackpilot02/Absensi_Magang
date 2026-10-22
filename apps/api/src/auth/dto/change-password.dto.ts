import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Password lama wajib diisi.' })
  @MaxLength(128)
  passwordLama!: string;

  @IsString()
  @MinLength(8, { message: 'Password baru minimal 8 karakter.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password baru harus mengandung huruf dan angka.',
  })
  passwordBaru!: string;
}
