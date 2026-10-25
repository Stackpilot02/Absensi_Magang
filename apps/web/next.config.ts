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
  // Cloudflare Pages hanya menyajikan berkas statis, jadi static export hanya
  // diaktifkan saat build production. Saat dev, export dimatikan agar proxy
  // /api dan peringatan "rewrites tidak didukung export" tidak muncul.
  // Header keamanan ada di `public/_headers` karena `headers()` tidak didukung
  // static export.
  ...(isDev ? {} : { output: 'export' as const, images: { unoptimized: true } }),
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins,
  // ponytail: dev saja — /api diproxy ke backend agar same-origin (bebas CORS &
  // cookie lintas host) walau web dibuka via localhost, IP LAN, atau tunnel.
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
