import {
  haversineDistanceMeters,
  isWithinRadius,
  isValidCoordinate,
  roundMeters,
} from './geo';

describe('geo', () => {
  const office = { latitude: 1.0601, longitude: 99.6644 };

  it('menghitung jarak satu derajat lintang sekitar 111 km', () => {
    const distance = haversineDistanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it('mengembalikan nol untuk koordinat yang sama', () => {
    expect(haversineDistanceMeters(office, office)).toBe(0);
  });

  it('menerima titik di dalam radius kantor', () => {
    const nearby = { latitude: office.latitude + 0.0002, longitude: office.longitude };
    expect(haversineDistanceMeters(nearby, office)).toBeLessThan(30);
    expect(isWithinRadius(nearby, office, 100)).toBe(true);
  });

  it('menolak titik di luar radius kantor', () => {
    const far = { latitude: office.latitude + 0.01, longitude: office.longitude };
    expect(isWithinRadius(far, office, 100)).toBe(false);
  });

  it('menolak radius tidak valid (<= 0)', () => {
    expect(isWithinRadius(office, office, 0)).toBe(false);
    expect(isWithinRadius(office, office, -10)).toBe(false);
  });

  it('memvalidasi rentang koordinat bumi', () => {
    expect(isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinate(office)).toBe(true);
  });

  it('membulatkan jarak satu desimal', () => {
    expect(roundMeters(12.34)).toBe(12.3);
    expect(roundMeters(12.36)).toBe(12.4);
  });
});
