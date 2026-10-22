import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: {
    default: 'Sistem Absensi Magang · BPS Kabupaten Padang Lawas',
    template: '%s · BPS Padang Lawas',
  },
  description:
    'Sistem absensi pegawai magang BPS Kabupaten Padang Lawas dengan validasi lokasi (geofencing) dan rekapitulasi otomatis.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#005BAA',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
