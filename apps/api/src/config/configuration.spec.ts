import { configuration } from './configuration';

/**
 * Requirement: jam masuk 07.30 WIB tanpa toleransi keterlambatan.
 * Konfigurasi divalidasi saat startup agar salah ketik tidak berujung error 500
 * ketika pegawai melakukan check-in.
 */
describe('konfigurasi jam kerja', () => {
  const KEYS = ['NODE_ENV', 'JWT_SECRET', 'WORK_START_TIME', 'LATE_TOLERANCE_MINUTES'] as const;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('memakai default 07.30 tanpa toleransi', () => {
    const config = configuration();

    expect(config.attendance.workStartTime).toBe('07:30');
    expect(config.attendance.lateToleranceMinutes).toBe(0);
  });

  it('membaca nilai dari environment', () => {
    process.env.WORK_START_TIME = '06:45';
    process.env.LATE_TOLERANCE_MINUTES = '5';

    const config = configuration();

    expect(config.attendance.workStartTime).toBe('06:45');
    expect(config.attendance.lateToleranceMinutes).toBe(5);
  });

  it('menerima toleransi 0 sebagai nilai valid', () => {
    process.env.LATE_TOLERANCE_MINUTES = '0';

    expect(configuration().attendance.lateToleranceMinutes).toBe(0);
  });

  it('menolak format jam masuk yang salah', () => {
    process.env.WORK_START_TIME = '7:30';
    expect(() => configuration()).toThrow(/WORK_START_TIME/);

    process.env.WORK_START_TIME = '24:00';
    expect(() => configuration()).toThrow(/WORK_START_TIME/);
  });

  it('menolak toleransi negatif atau pecahan', () => {
    process.env.LATE_TOLERANCE_MINUTES = '-1';
    expect(() => configuration()).toThrow(/LATE_TOLERANCE_MINUTES/);

    process.env.LATE_TOLERANCE_MINUTES = '1.5';
    expect(() => configuration()).toThrow(/LATE_TOLERANCE_MINUTES/);
  });
});
