import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Versi uji: jeda retry dibuat 0 agar test cepat. */
class TestPrismaService extends PrismaService {
  protected retryDelayMs(): number {
    return 0;
  }
}

function buildService(): TestPrismaService {
  return new TestPrismaService({
    datasources: { db: { url: 'postgresql://user:password@localhost:5432/absensi_test' } },
  });
}

describe('PrismaService (retry koneksi database serverless)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('langsung terhubung bila database siap', async () => {
    const service = buildService();
    const connect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('mencoba ulang saat database baru bangun dari suspend', async () => {
    const service = buildService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockRejectedValueOnce(new Error('P1001: Can\'t reach database server'))
      .mockResolvedValueOnce(undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('menyerah setelah tiga percobaan dan meneruskan error asli', async () => {
    const service = buildService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockRejectedValue(new Error('P1001: Can\'t reach database server'));

    await expect(service.onModuleInit()).rejects.toThrow(/P1001/);
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('menutup koneksi saat modul dihentikan', async () => {
    const service = buildService();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
