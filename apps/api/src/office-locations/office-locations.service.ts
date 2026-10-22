import { Injectable, NotFoundException } from '@nestjs/common';
import { OfficeLocation } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateOfficeLocationDto,
  UpdateOfficeLocationDto,
} from './dto/office-location.dto';

@Injectable()
export class OfficeLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<OfficeLocation[]> {
    return this.prisma.officeLocation.findMany({ orderBy: { name: 'asc' } });
  }

  /** Lokasi aktif pertama dipakai sebagai pusat geofencing absensi. */
  async findActive(): Promise<OfficeLocation> {
    const location = await this.prisma.officeLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!location) {
      throw new NotFoundException(
        'Lokasi kantor belum dikonfigurasi. Hubungi admin untuk mengatur lokasi & radius.',
      );
    }

    return location;
  }

  async create(dto: CreateOfficeLocationDto): Promise<OfficeLocation> {
    return this.prisma.officeLocation.create({
      data: {
        name: dto.name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius: dto.radius ?? 100,
      },
    });
  }

  async update(id: string, dto: UpdateOfficeLocationDto): Promise<OfficeLocation> {
    await this.ensureExists(id);
    return this.prisma.officeLocation.update({ where: { id }, data: dto });
  }

  async deactivate(id: string): Promise<{ message: string }> {
    await this.ensureExists(id);
    await this.prisma.officeLocation.update({ where: { id }, data: { isActive: false } });
    return { message: 'Lokasi kantor dinonaktifkan.' };
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.officeLocation.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException('Lokasi kantor tidak ditemukan.');
    }
  }
}
