import type { NextConfig } from 'next';

/**
 * Frontend dan backend berada pada domain berbeda, sehingga URL API harus diisi
 * eksplisit. Tanpa guard ini, build production akan diam-diam menunjuk ke
 * localhost (nilai fallback di `lib/api.ts`) dan aplikasi gagal terhubung.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (process.env.NODE_ENV === 'production') {
  if (!apiUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_URL wajib diisi saat build production. ' +
        'Contoh: https://api-absensi.example.com/api',
    );
  }
  try {
    new URL(apiUrl);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL bukan URL absolut yang valid: "${apiUrl}". ` +
        'Contoh yang benar: https://api-absensi.example.com/api',
    );
  }
}

/**
 * Origin yang boleh memakai resource dev Next.js (HMR/asset) saat diakses dari
 * perangkat lain. Isi variabel `ALLOWED_DEV_ORIGINS` dipisah koma, mis.
 * `192.168.100.48,abc.trycloudflare.com`. Kosong = hanya localhost.
 */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins,
  async rewrites() {
    // ponytail: dev saja — proxy /api ke backend agar same-origin (bebas CORS
    // & cookie lintas host) walau web dibuka via localhost, IP LAN, atau tunnel.
    return process.env.NODE_ENV === 'production'
      ? []
      : [{ source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(), microphone=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
