import type { NextConfig } from 'next';

/**
 * Frontend di Cloudflare Pages memanggil `/api` pada origin yang sama.
 * Cloudflare Pages Function `functions/api/[[path]].ts` meneruskan request
 * ke API NestJS melalui Cloudflare Tunnel.
 *
 * Nilai absolut tetap didukung untuk deployment alternatif (mis. Vercel).
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (process.env.NODE_ENV === 'production') {
  if (!apiUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_URL wajib diisi saat build production. ' +
        'Gunakan "/api" untuk Cloudflare Pages atau URL absolut seperti ' +
        '"https://api-absensi.example.com/api".',
    );
  }

  // Path relatif (mis. "/api") dipakai agar browser tetap berada di origin
  // Cloudflare Pages. Selain itu, nilai harus URL absolut yang valid.
  const isRelativePath = apiUrl.startsWith('/') && !apiUrl.startsWith('//');
  if (!isRelativePath) {
    try {
      new URL(apiUrl);
    } catch {
      throw new Error(
        `NEXT_PUBLIC_API_URL bukan path relatif atau URL absolut yang valid: "${apiUrl}". ` +
          'Gunakan "/api" atau contoh "https://api-absensi.example.com/api".',
      );
    }
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

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Cloudflare Pages hanya menyajikan berkas statis. Header keamanan dipindah
  // ke `public/_headers` karena `headers()` tidak didukung static export.
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export tidak memiliki image optimizer server-side.
  images: { unoptimized: true },
  allowedDevOrigins,
  // ponytail: dev saja — static export tidak mendukung rewrites, jadi kunci ini
  // hanya dipasang saat dev agar build production tidak memunculkan peringatan.
  // Saat dev, /api diproxy ke backend agar same-origin (bebas CORS & cookie
  // lintas host) walau web dibuka via localhost, IP LAN, atau tunnel.
  ...(isDev
    ? {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
          ];
        },
      }
    : {}),
};

export default nextConfig;
