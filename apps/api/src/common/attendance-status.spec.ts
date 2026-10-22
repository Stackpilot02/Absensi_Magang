import {
  computeAttendanceStatus,
  evaluateClockSkew,
  isWeekend,
  parseTimeToMinutes,
  resolveDailyStatus,
} from './attendance-status';

const SCHEDULE = { workStartTime: '08:00', lateToleranceMinutes: 15 };

describe('attendance-status', () => {
  it('mengubah HH:mm menjadi menit', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('08:15')).toBe(495);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('menolak format jam tidak valid', () => {
    expect(() => parseTimeToMinutes('8:00')).toThrow();
    expect(() => parseTimeToMinutes('24:00')).toThrow();
    expect(() => parseTimeToMinutes('08:60')).toThrow();
  });

  it('menandai HADIR bila tiba sebelum batas toleransi', () => {
    // 08:10 WIB = 01:10 UTC
    expect(computeAttendanceStatus(new Date('2026-10-21T01:10:00Z'), SCHEDULE)).toBe('HADIR');
  });

  it('menandai HADIR tepat pada batas toleransi', () => {
    // 08:15 WIB = 01:15 UTC
    expect(computeAttendanceStatus(new Date('2026-10-21T01:15:00Z'), SCHEDULE)).toBe('HADIR');
  });

  it('menandai TERLAMBAT setelah batas toleransi', () => {
    // 08:16 WIB = 01:16 UTC
    expect(computeAttendanceStatus(new Date('2026-10-21T01:16:00Z'), SCHEDULE)).toBe('TERLAMBAT');
  });

  it('mengenali akhir pekan', () => {
    expect(isWeekend(new Date('2026-10-24T03:00:00Z'))).toBe(true); // Sabtu
    expect(isWeekend(new Date('2026-10-25T03:00:00Z'))).toBe(true); // Minggu
    expect(isWeekend(new Date('2026-10-21T03:00:00Z'))).toBe(false); // Rabu
  });

  it('mendeteksi manipulasi jam perangkat', () => {
    const serverNow = new Date('2026-10-21T01:00:00Z');
    expect(evaluateClockSkew(serverNow, '2026-10-21T00:59:30Z', 300).suspicious).toBe(false);
    expect(evaluateClockSkew(serverNow, '2026-10-21T00:50:00Z', 300).suspicious).toBe(true);
    expect(evaluateClockSkew(serverNow, 'bukan-tanggal', 300).suspicious).toBe(true);
    expect(evaluateClockSkew(serverNow, undefined, 300)).toEqual({
      skewSeconds: 0,
      suspicious: false,
    });
  });

  it('menentukan status harian untuk laporan', () => {
    const weekday = new Date('2026-10-21T00:00:00Z');
    const saturday = new Date('2026-10-24T00:00:00Z');

    expect(resolveDailyStatus({ date: weekday, attendanceStatus: 'HADIR' })).toBe('HADIR');
    expect(resolveDailyStatus({ date: weekday, attendanceStatus: 'TERLAMBAT' })).toBe('TERLAMBAT');
    expect(
      resolveDailyStatus({ date: weekday, attendanceStatus: 'HADIR', approvedLeave: 'IZIN' }),
    ).toBe('IZIN');
    expect(resolveDailyStatus({ date: weekday })).toBe('ALPHA');
    expect(resolveDailyStatus({ date: saturday })).toBe('LIBUR');
  });
});
