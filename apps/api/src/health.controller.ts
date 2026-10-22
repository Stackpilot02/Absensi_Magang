import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Ping database. Berguna untuk uptime monitor sekaligus "membangunkan"
   * compute Neon yang sedang suspend sebelum pengguna mengakses aplikasi.
   */
  @Public()
  @Get('db')
  async database(): Promise<{ status: string; latencyMs: number }> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - startedAt };
    } catch {
      throw new ServiceUnavailableException('Koneksi database tidak tersedia.');
    }
  }
}
