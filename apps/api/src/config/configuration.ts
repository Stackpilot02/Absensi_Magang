/**
 * Pemusatan konfigurasi dari environment variable.
 * Tidak ada credential yang di-hardcode di kode.
 */
export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  jwt: {
    secret: string;
    expiresIn: string;
    expiresInSeconds: number;
  };
  cookie: {
    name: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    maxAgeMs: number;
  };
  attendance: {
    workStartTime: string;
    lateToleranceMinutes: number;
    maxClockSkewSeconds: number;
  };
}

const DEFAULT_JWT_EXPIRES_IN = '8h';
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;
/** Jam masuk kantor BPS Kab. Padang Lawas: 07.30 WIB tanpa toleransi. */
const DEFAULT_WORK_START_TIME = '07:30';
const DEFAULT_LATE_TOLERANCE_MINUTES = 0;
const MAX_LATE_TOLERANCE_MINUTES = 180;

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Validasi jam masuk agar kesalahan konfigurasi ketahuan saat startup, bukan saat absensi. */
function readWorkStartTime(value: string | undefined): string {
  const workStartTime = value ?? DEFAULT_WORK_START_TIME;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(workStartTime)) {
    throw new Error(
      `WORK_START_TIME tidak valid ("${workStartTime}"). Gunakan format HH:mm, contoh 07:30.`,
    );
  }
  return workStartTime;
}

/** Toleransi 0 berarti check-in lewat 1 menit pun sudah TERLAMBAT. */
function readLateTolerance(value: string | undefined): number {
  const minutes = readNumber(value, DEFAULT_LATE_TOLERANCE_MINUTES);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_LATE_TOLERANCE_MINUTES) {
    throw new Error(
      `LATE_TOLERANCE_MINUTES harus bilangan bulat 0-${MAX_LATE_TOLERANCE_MINUTES}.`,
    );
  }
  return minutes;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

/**
 * Mengubah durasi ("8h", "30m", "3600") menjadi detik.
 * Dipakai agar tipe `expiresIn` pada JWT selalu numerik.
 */
export function parseDurationSeconds(value: string, fallbackSeconds = 28_800): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

  return amount * (multipliers[unit] ?? 1);
}

/** Nilai SameSite yang diterima browser. */
const SAME_SITE_VALUES = ['lax', 'strict', 'none'] as const;
type SameSiteValue = (typeof SAME_SITE_VALUES)[number];

function readSameSite(value: string | undefined): SameSiteValue {
  const normalized = (value ?? 'lax').trim().toLowerCase();
  if (!SAME_SITE_VALUES.includes(normalized as SameSiteValue)) {
    throw new Error(
      `COOKIE_SAME_SITE tidak valid ("${value}"). Gunakan lax, strict, atau none.`,
    );
  }
  return normalized as SameSiteValue;
}

export const configuration = (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const secret = process.env.JWT_SECRET ?? '';

  if (nodeEnv === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET wajib diisi minimal 32 karakter pada environment production.');
  }

  const cookieSecure = readBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production');
  const cookieSameSite = readSameSite(process.env.COOKIE_SAME_SITE);

  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new Error(
      'COOKIE_SAME_SITE=none mengharuskan COOKIE_SECURE=true, ' +
        'karena browser menolak cookie SameSite=None tanpa Secure.',
    );
  }

  return {
    nodeEnv,
    port: readNumber(process.env.PORT, 3001),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    jwt: {
      secret: secret || 'dev-only-secret-jangan-dipakai-di-production',
      expiresIn: process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN,
      expiresInSeconds: parseDurationSeconds(
        process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN,
      ),
    },
    cookie: {
      name: 'absensi_token',
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAgeMs: COOKIE_MAX_AGE_MS,
    },
    attendance: {
      workStartTime: readWorkStartTime(process.env.WORK_START_TIME),
      lateToleranceMinutes: readLateTolerance(process.env.LATE_TOLERANCE_MINUTES),
      maxClockSkewSeconds: readNumber(process.env.MAX_CLOCK_SKEW_SECONDS, 300),
    },
  };
};
