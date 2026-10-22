import { IsBoolean, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateOfficeLocationDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsLatitude({ message: 'Latitude tidak valid.' })
  latitude!: number;

  @IsLongitude({ message: 'Longitude tidak valid.' })
  longitude!: number;

  @IsOptional()
  @IsInt()
  @Min(10, { message: 'Radius minimal 10 meter.' })
  @Max(5000, { message: 'Radius maksimal 5000 meter.' })
  radius?: number;
}

export class UpdateOfficeLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsLatitude({ message: 'Latitude tidak valid.' })
  latitude?: number;

  @IsOptional()
  @IsLongitude({ message: 'Longitude tidak valid.' })
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(10, { message: 'Radius minimal 10 meter.' })
  @Max(5000, { message: 'Radius maksimal 5000 meter.' })
  radius?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
