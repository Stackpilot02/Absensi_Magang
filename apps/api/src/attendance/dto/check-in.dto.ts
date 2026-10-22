import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInDto {
  @IsLatitude({ message: 'Latitude tidak valid.' })
  latitude!: number;

  @IsLongitude({ message: 'Longitude tidak valid.' })
  longitude!: number;

  /** Waktu perangkat (ISO 8601) untuk deteksi manipulasi jam. */
  @IsOptional()
  @IsString()
  deviceTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
