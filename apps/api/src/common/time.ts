/**
 * Utilitas waktu dengan zona Asia/Jakarta.
 * Server bisa berjalan di zona UTC (mis. Railway), sehingga perhitungan
 * tanggal absensi tidak boleh bergantung pada zona waktu mesin.
 */
export const APP_TIMEZONE = 'Asia/Jakarta';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Mengambil komponen tanggal/jam pada zona waktu tertentu. */
export function getZonedParts(date: Date, timeZone: string = APP_TIMEZONE): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((item) => item.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  };
}

/** Kunci tanggal lokal (YYYY-MM-DD) pada zona Asia/Jakarta. */
export function jakartaDateKey(date: Date, timeZone: string = APP_TIMEZONE): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Mengubah tanggal menjadi nilai kolom `@db.Date`:
 * tengah malam UTC dari tanggal lokal Jakarta.
 */
export function toDateOnly(date: Date, timeZone: string = APP_TIMEZONE): Date {
  return new Date(`${jakartaDateKey(date, timeZone)}T00:00:00.000Z`);
}

/** Mengubah string YYYY-MM-DD menjadi Date pada tengah malam UTC. */
export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Format tanggal tidak valid: ${value}. Gunakan YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Tanggal tidak valid: ${value}`);
  }
  return parsed;
}

/** Kunci tanggal (YYYY-MM-DD) dari nilai kolom `@db.Date` yang dibaca Prisma. */
export function dateOnlyToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Menit sejak tengah malam pada zona Asia/Jakarta. */
export function jakartaMinutesOfDay(date: Date, timeZone: string = APP_TIMEZONE): number {
  const { hour, minute } = getZonedParts(date, timeZone);
  return hour * 60 + minute;
}

/** Nama hari pada zona Asia/Jakarta. */
export function jakartaWeekday(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone, weekday: 'long' }).format(date);
}

/** Rentang tanggal (inklusif) untuk sebuah bulan & tahun pada zona Jakarta. */
export function monthRange(year: number, month: number): { start: Date; end: Date; days: number } {
  if (month < 1 || month > 12) {
    throw new Error('Bulan harus di antara 1 dan 12.');
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const days = end.getUTCDate();
  return { start, end, days };
}

/** Jam berjalan dalam format HH:mm (Asia/Jakarta). */
export function jakartaTimeLabel(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
