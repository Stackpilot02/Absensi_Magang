/**
 * Aturan penentuan status absensi dan deteksi manipulasi waktu perangkat.
 */
import { jakartaMinutesOfDay, getZonedParts, APP_TIMEZONE } from './time';

export type AttendanceStatusValue =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'IZIN'
  | 'SAKIT'
  | 'ALPHA'
  | 'LIBUR';

export interface WorkSchedule {
  /** Jam masuk kantor, format HH:mm (Asia/Jakarta). */
  workStartTime: string;
  /** Toleransi keterlambatan dalam menit. */
  lateToleranceMinutes: number;
}

/** Mengubah "HH:mm" menjadi menit sejak tengah malam. */
export function parseTimeToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error(`Format jam tidak valid: ${value}. Gunakan HH:mm.`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Status check-in: HADIR bila masih dalam toleransi, TERLAMBAT bila lewat.
 */
export function computeAttendanceStatus(
  checkIn: Date,
  schedule: WorkSchedule,
  timeZone: string = APP_TIMEZONE,
): Extract<AttendanceStatusValue, 'HADIR' | 'TERLAMBAT'> {
  const arrivalMinutes = jakartaMinutesOfDay(checkIn, timeZone);
  const limitMinutes = parseTimeToMinutes(schedule.workStartTime) + schedule.lateToleranceMinutes;
  return arrivalMinutes <= limitMinutes ? 'HADIR' : 'TERLAMBAT';
}

/** Hari Sabtu/Minggu dianggap libur kantor. */
export function isWeekend(date: Date, timeZone: string = APP_TIMEZONE): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return weekday === 'Sat' || weekday === 'Sun';
}

export interface ClockSkewResult {
  skewSeconds: number;
  suspicious: boolean;
}

/**
 * Membandingkan jam perangkat dengan jam server.
 * Selisih melebihi ambang dianggap upaya manipulasi waktu perangkat.
 */
export function evaluateClockSkew(
  serverNow: Date,
  deviceTimeIso: string | undefined,
  maxSkewSeconds: number,
): ClockSkewResult {
  if (!deviceTimeIso) {
    return { skewSeconds: 0, suspicious: false };
  }

  const deviceTime = new Date(deviceTimeIso);
  if (Number.isNaN(deviceTime.getTime())) {
    return { skewSeconds: maxSkewSeconds + 1, suspicious: true };
  }

  const skewSeconds = Math.abs(Math.round((serverNow.getTime() - deviceTime.getTime()) / 1000));
  return { skewSeconds, suspicious: skewSeconds > maxSkewSeconds };
}

/**
 * Menghitung status untuk laporan bulanan:
 * - akhir pekan -> LIBUR
 * - ada pengajuan izin/sakit disetujui -> IZIN/SAKIT
 * - ada absensi -> HADIR/TERLAMBAT
 * - tidak ada data -> ALPHA
 */
export function resolveDailyStatus(input: {
  date: Date;
  attendanceStatus?: AttendanceStatusValue | null;
  approvedLeave?: 'IZIN' | 'SAKIT' | null;
  timeZone?: string;
}): AttendanceStatusValue {
  if (isWeekend(input.date, input.timeZone ?? APP_TIMEZONE)) {
    return 'LIBUR';
  }
  if (input.approvedLeave) {
    return input.approvedLeave;
  }
  if (input.attendanceStatus) {
    return input.attendanceStatus;
  }
  return 'ALPHA';
}

/** Label status untuk kebutuhan dokumen/laporan. */
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatusValue, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  ALPHA: 'Alpha',
  LIBUR: 'Libur',
};
