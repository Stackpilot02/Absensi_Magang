export interface BrowserPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  deviceTime: string;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

/**
 * Mengambil posisi perangkat. Waktu perangkat dikirim bersama koordinat
 * agar backend dapat mendeteksi manipulasi jam.
 */
export function getCurrentPosition(): Promise<BrowserPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Perangkat ini tidak mendukung layanan lokasi (GPS).'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          deviceTime: new Date().toISOString(),
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Izin lokasi ditolak. Aktifkan akses lokasi pada browser untuk melakukan absensi.',
          2: 'Lokasi tidak tersedia. Pastikan GPS aktif lalu coba lagi.',
          3: 'Permintaan lokasi melebihi batas waktu. Coba lagi di tempat terbuka.',
        };
        reject(new Error(messages[error.code] ?? 'Gagal mendapatkan lokasi perangkat.'));
      },
      GEO_OPTIONS,
    );
  });
}
