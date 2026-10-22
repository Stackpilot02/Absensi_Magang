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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
