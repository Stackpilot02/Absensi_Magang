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

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export const configuration = (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const secret = process.env.JWT_SECRET ?? '';

  if (nodeEnv === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET wajib diisi minimal 32 karakter pada environment production.');
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
      secure: readBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production'),
      sameSite: (process.env.COOKIE_SAME_SITE as AppConfiguration['cookie']['sameSite']) ?? 'lax',
      maxAgeMs: COOKIE_MAX_AGE_MS,
    },
    attendance: {
      workStartTime: process.env.WORK_START_TIME ?? '08:00',
      lateToleranceMinutes: readNumber(process.env.LATE_TOLERANCE_MINUTES, 15),
      maxClockSkewSeconds: readNumber(process.env.MAX_CLOCK_SKEW_SECONDS, 300),
    },
  };
};
