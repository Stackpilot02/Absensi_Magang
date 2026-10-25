import { resolveProxiedClientIp } from './proxy-client-ip';

describe('resolveProxiedClientIp', () => {
  const secret = 'secret-proxy-yang-cukup-panjang';

  it('mengembalikan IP klien bila secret cocok', () => {
    expect(
      resolveProxiedClientIp(
        {
          'x-proxy-secret': secret,
          'x-client-ip': '103.10.20.30',
        },
        secret,
      ),
    ).toBe('103.10.20.30');
  });

  it('mendukung alamat IPv6', () => {
    expect(
      resolveProxiedClientIp(
        {
          'x-proxy-secret': secret,
          'x-client-ip': '2001:db8::1',
        },
        secret,
      ),
    ).toBe('2001:db8::1');
  });

  it('menolak secret yang salah', () => {
    expect(
      resolveProxiedClientIp(
        {
          'x-proxy-secret': 'secret-yang-salah',
          'x-client-ip': '103.10.20.30',
        },
        secret,
      ),
    ).toBeNull();
  });

  it('menolak bila secret proxy belum dikonfigurasi', () => {
    expect(
      resolveProxiedClientIp(
        {
          'x-proxy-secret': secret,
          'x-client-ip': '103.10.20.30',
        },
        '',
      ),
    ).toBeNull();
  });

  it('menolak nilai IP yang tidak valid', () => {
    expect(
      resolveProxiedClientIp(
        {
          'x-proxy-secret': secret,
          'x-client-ip': 'bukan-ip',
        },
        secret,
      ),
    ).toBeNull();
  });

  it('mengambil nilai pertama bila header berupa array', () => {
    expect(
      resolveProxiedClientIp(
        {
          'x-proxy-secret': [secret, 'lain'],
          'x-client-ip': ['103.10.20.30', '103.10.20.31'],
        },
        secret,
      ),
    ).toBe('103.10.20.30');
  });
});
