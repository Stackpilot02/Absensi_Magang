import { configuration } from './configuration';

/**
 * Requirement: jam masuk 07.30 WIB tanpa toleransi keterlambatan.
 * Konfigurasi divalidasi saat startup agar salah ketik tidak berujung error 500
 * ketika pegawai melakukan check-in.
 */
describe('konfigurasi jam kerja', () => {
  const KEYS = [
    'NODE_ENV',
    'JWT_SECRET',
    'WORK_START_TIME',
    'WORK_END_TIME',
    'LATE_TOLERANCE_MINUTES',
    'COOKIE_SAME_SITE',
    'COOKIE_SECURE',
    'HOST',
    'PROXY_SHARED_SECRET',
  ] as const;
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

  it('memakai default 07.30 masuk dan 16.00 pulang tanpa toleransi', () => {
    const config = configuration();

    expect(config.attendance.workStartTime).toBe('07:30');
    expect(config.attendance.workEndTime).toBe('16:00');
    expect(config.attendance.lateToleranceMinutes).toBe(0);
  });

  it('membaca nilai dari environment', () => {
    process.env.WORK_START_TIME = '06:45';
    process.env.WORK_END_TIME = '15:30';
    process.env.LATE_TOLERANCE_MINUTES = '5';

    const config = configuration();

    expect(config.attendance.workStartTime).toBe('06:45');
    expect(config.attendance.workEndTime).toBe('15:30');
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

  it('menolak jam pulang yang formatnya salah atau tidak setelah jam masuk', () => {
    process.env.WORK_END_TIME = '16.00';
    expect(() => configuration()).toThrow(/WORK_END_TIME/);

    process.env.WORK_END_TIME = '07:30';
    expect(() => configuration()).toThrow(/WORK_END_TIME/);

    process.env.WORK_END_TIME = '06:00';
    expect(() => configuration()).toThrow(/WORK_END_TIME/);
  });

  it('menolak toleransi negatif atau pecahan', () => {
    process.env.LATE_TOLERANCE_MINUTES = '-1';
    expect(() => configuration()).toThrow(/LATE_TOLERANCE_MINUTES/);

    process.env.LATE_TOLERANCE_MINUTES = '1.5';
    expect(() => configuration()).toThrow(/LATE_TOLERANCE_MINUTES/);
  });

  it('membaca HOST dan PROXY_SHARED_SECRET', () => {
    process.env.HOST = '127.0.0.1';
    process.env.PROXY_SHARED_SECRET = 'abcdefghijklmnop';

    const config = configuration();

    expect(config.host).toBe('127.0.0.1');
    expect(config.proxySharedSecret).toBe('abcdefghijklmnop');
  });

  it('menolak PROXY_SHARED_SECRET yang terlalu pendek', () => {
    process.env.PROXY_SHARED_SECRET = 'pendek';

    expect(() => configuration()).toThrow(/PROXY_SHARED_SECRET/);
  });

  describe('cookie sesi', () => {
    it('memakai SameSite=lax dan tidak Secure di development', () => {
      const { cookie } = configuration();

      expect(cookie.sameSite).toBe('lax');
      expect(cookie.secure).toBe(false);
    });

    it('menerima SameSite=none bila Secure aktif', () => {
      process.env.COOKIE_SAME_SITE = 'none';
      process.env.COOKIE_SECURE = 'true';

      const { cookie } = configuration();

      expect(cookie.sameSite).toBe('none');
      expect(cookie.secure).toBe(true);
    });

    it('menolak SameSite=none tanpa Secure', () => {
      process.env.COOKIE_SAME_SITE = 'none';
      process.env.COOKIE_SECURE = 'false';

      expect(() => configuration()).toThrow(/COOKIE_SECURE=true/);
    });

    it('menolak nilai SameSite yang tidak dikenal', () => {
      process.env.COOKIE_SAME_SITE = 'no-ne';

      expect(() => configuration()).toThrow(/COOKIE_SAME_SITE/);
    });
  });
});
