import {
  dateOnlyToKey,
  jakartaDateKey,
  jakartaMinutesOfDay,
  monthRange,
  parseDateOnly,
  toDateOnly,
} from './time';

describe('time (Asia/Jakarta)', () => {
  it('menggeser tanggal sesuai zona Jakarta, bukan zona server', () => {
    // 21 Oktober 2026 pukul 17:30 UTC = 22 Oktober 2026 00:30 WIB
    const utcEvening = new Date('2026-10-21T17:30:00.000Z');
    expect(jakartaDateKey(utcEvening)).toBe('2026-10-22');
    expect(toDateOnly(utcEvening).toISOString()).toBe('2026-10-22T00:00:00.000Z');
  });

  it('menyimpan tanggal sebagai tengah malam UTC', () => {
    const value = new Date('2026-10-22T15:45:00.000Z');
    const stored = toDateOnly(value);
    expect(stored.getUTCHours()).toBe(0);
    expect(dateOnlyToKey(stored)).toBe('2026-10-22');
  });

  it('menghitung menit sejak tengah malam pada zona Jakarta', () => {
    // 01:10 UTC = 08:10 WIB
    expect(jakartaMinutesOfDay(new Date('2026-10-21T01:10:00.000Z'))).toBe(8 * 60 + 10);
  });

  it('menolak format tanggal yang salah', () => {
    expect(() => parseDateOnly('22-10-2026')).toThrow(/Format tanggal tidak valid/);
    expect(() => parseDateOnly('2026-13-01')).toThrow(/Tanggal tidak valid/);
    expect(parseDateOnly('2026-10-22').toISOString()).toBe('2026-10-22T00:00:00.000Z');
  });

  it('menghitung jumlah hari pada rentang bulan', () => {
    expect(monthRange(2024, 2).days).toBe(29);
    expect(monthRange(2026, 2).days).toBe(28);
    expect(monthRange(2026, 10).days).toBe(31);
    expect(monthRange(2026, 10).start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(monthRange(2026, 10).end.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('menolak bulan di luar 1-12', () => {
    expect(() => monthRange(2026, 0)).toThrow();
    expect(() => monthRange(2026, 13)).toThrow();
  });
});
