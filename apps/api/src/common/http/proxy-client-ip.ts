import { isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

function firstHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Mengembalikan IP klien hanya jika request membawa secret proxy yang cocok.
 *
 * Cloudflare Pages Function mengisi `X-Client-IP` dari `CF-Connecting-IP`
 * dan menandatangani request dengan `X-Proxy-Secret`. Validasi `isIP`
 * mencegah nilai header disalahgunakan sebagai `X-Forwarded-For`.
 */
export function resolveProxiedClientIp(
  headers: IncomingHttpHeaders,
  expectedSecret: string | undefined,
): string | null {
  const secret = (expectedSecret ?? '').trim();
  if (!secret) return null;

  const providedSecret = firstHeader(headers['x-proxy-secret']);
  const clientIp = firstHeader(headers['x-client-ip']);

  if (!providedSecret || providedSecret !== secret || !clientIp) return null;
  if (isIP(clientIp) === 0) return null;

  return clientIp;
}
