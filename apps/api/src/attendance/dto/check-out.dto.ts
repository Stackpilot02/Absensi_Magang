import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckOutDto {
  @IsLatitude({ message: 'Latitude tidak valid.' })
  latitude!: number;

  @IsLongitude({ message: 'Longitude tidak valid.' })
  longitude!: number;

  @IsOptional()
  @IsString()
  deviceTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
