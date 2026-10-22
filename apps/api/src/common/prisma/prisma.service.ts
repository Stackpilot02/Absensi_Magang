import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Jumlah percobaan koneksi awal (Neon bisa bangun dari kondisi suspend). */
  protected readonly maxConnectAttempts = 3;

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Database serverless (Neon) dapat ter-suspend saat tidak ada aktivitas.
   * Percobaan pertama setelah idle bisa gagal/timeout, sehingga koneksi
   * diulang dengan jeda eksponensial sebelum aplikasi dinyatakan gagal start.
   */
  protected async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await this.$connect();
      if (attempt > 1) {
        this.logger.log(`Koneksi database berhasil pada percobaan ke-${attempt}.`);
      }
    } catch (error) {
      if (attempt >= this.maxConnectAttempts) {
        // Jangan pernah menuliskan connection string ke log (mengandung kredensial).
        this.logger.error(
          `Gagal terhubung ke database setelah ${attempt} percobaan. ` +
            'Periksa DATABASE_URL / DIRECT_URL dan status project database.',
        );
        throw error;
      }

      const delay = this.retryDelayMs(attempt);
      this.logger.warn(`Koneksi database gagal (percobaan ${attempt}). Mencoba lagi dalam ${delay} ms.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      await this.connectWithRetry(attempt + 1);
    }
  }

  /** Jeda antar percobaan (ms); dipisah agar mudah diuji. */
  protected retryDelayMs(attempt: number): number {
    return 500 * 2 ** (attempt - 1);
  }
}
