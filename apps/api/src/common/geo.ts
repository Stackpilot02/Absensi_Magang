/** Perhitungan jarak geografis untuk validasi geofencing absensi. */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Jarak antara dua koordinat menggunakan formula haversine (meter).
 */
export function haversineDistanceMeters(from: Coordinate, to: Coordinate): number {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Apakah titik berada di dalam radius kantor.
 * Toleransi 0.5 meter dipakai agar nilai tepat di batas radius tetap diterima.
 */
export function isWithinRadius(
  point: Coordinate,
  center: Coordinate,
  radiusMeters: number,
): boolean {
  if (radiusMeters <= 0) {
    return false;
  }
  return haversineDistanceMeters(point, center) <= radiusMeters + 0.5;
}

/** Pembulatan jarak untuk disimpan/ditampilkan (meter, 1 desimal). */
export function roundMeters(distance: number): number {
  return Math.round(distance * 10) / 10;
}

/** Validasi rentang koordinat bumi. */
export function isValidCoordinate(point: Coordinate): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}
