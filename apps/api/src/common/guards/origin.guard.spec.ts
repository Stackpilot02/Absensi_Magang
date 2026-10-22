import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { OriginGuard } from './origin.guard';

function buildContext(method: string, origin?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers: origin ? { origin } : {} }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(allowed: string): OriginGuard {
  const config = { get: () => allowed } as unknown as ConfigService;
  return new OriginGuard(config);
}

describe('OriginGuard (anti-CSRF)', () => {
  const guard = buildGuard('http://localhost:3000, https://absensi.example.com');

  it('meloloskan request baca dari origin mana pun', () => {
    expect(guard.canActivate(buildContext('GET', 'https://evil.example'))).toBe(true);
    expect(guard.canActivate(buildContext('OPTIONS', 'https://evil.example'))).toBe(true);
  });

  it('meloloskan request tulis dari origin yang terdaftar', () => {
    expect(guard.canActivate(buildContext('POST', 'http://localhost:3000'))).toBe(true);
    expect(guard.canActivate(buildContext('PATCH', 'https://absensi.example.com'))).toBe(true);
  });

  it('menolak request tulis dari origin asing', () => {
    expect(() => guard.canActivate(buildContext('POST', 'https://evil.example'))).toThrow(
      ForbiddenException,
    );
  });

  it('meloloskan request tanpa header Origin (bukan browser)', () => {
    expect(guard.canActivate(buildContext('POST'))).toBe(true);
  });

  it('menolak bila CORS_ORIGIN kosong tetapi ada Origin', () => {
    const emptyGuard = buildGuard('');
    expect(() => emptyGuard.canActivate(buildContext('DELETE', 'http://localhost:3000'))).toThrow(
      ForbiddenException,
    );
  });
});
