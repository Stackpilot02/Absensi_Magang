/**
 * Proxy same-origin Cloudflare Pages untuk API NestJS di VPS.
 *
 * Browser memanggil https://<pages>/api/*, lalu function ini meneruskan
 * request ke https://api.<domain>/api/* melalui Cloudflare Tunnel.
 * Dengan cara ini cookie JWT tetap first-party dan `SameSite=Lax` dapat
 * dipakai tanpa membuka port 80/443 di VPS.
 */
interface Env {
  /** Origin API, contoh: https://api-absensi.example.com (tanpa path). */
  API_ORIGIN?: string;
  /** Harus sama dengan PROXY_SHARED_SECRET di API. */
  PROXY_SHARED_SECRET?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'cdn-loop',
];

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const origin = env.API_ORIGIN?.trim().replace(/\/+$/, '');
  const proxySecret = env.PROXY_SHARED_SECRET?.trim();

  if (!origin || !proxySecret) {
    console.error(
      'API_ORIGIN atau PROXY_SHARED_SECRET belum dikonfigurasi pada Cloudflare Pages.',
    );
    return jsonError(500, 'Konfigurasi server belum lengkap.');
  }

  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    console.error('API_ORIGIN bukan URL yang valid.');
    return jsonError(500, 'Konfigurasi server tidak valid.');
  }

  const isLocalOrigin =
    base.hostname === 'localhost' || base.hostname === '127.0.0.1';
  if (base.protocol !== 'https:' && !isLocalOrigin) {
    console.error('API_ORIGIN wajib memakai HTTPS.');
    return jsonError(500, 'Konfigurasi server tidak valid.');
  }
  if (base.pathname !== '/' && base.pathname !== '') {
    console.error('API_ORIGIN harus berisi origin saja, tanpa path.');
    return jsonError(500, 'Konfigurasi server tidak valid.');
  }

  const requestUrl = new URL(request.url);
  const target = new URL(`${base.origin}${requestUrl.pathname}${requestUrl.search}`);

  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);

  // Jangan teruskan header yang bisa dipalsukan klien. IP asli diambil dari
  // CF-Connecting-IP yang di-set Cloudflare, lalu ditandai dengan secret.
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');
  headers.delete('cf-ipcountry');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');
  headers.delete('x-client-ip');
  headers.delete('x-proxy-secret');

  headers.set('x-proxy-secret', proxySecret);
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''));

  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-client-ip', clientIp);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), init);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'kesalahan tidak diketahui';
    console.error(`Gagal menghubungi API: ${message}`);
    return jsonError(502, 'API tidak dapat dihubungi.');
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of HOP_BY_HOP_HEADERS) responseHeaders.delete(name);

  // Pertahankan seluruh header Set-Cookie (login dan logout).
  const setCookies = upstream.headers.getSetCookie();
  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie');
    for (const cookie of setCookies) responseHeaders.append('set-cookie', cookie);
  }

  // Response API tidak boleh di-cache oleh browser/CDN.
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('x-content-type-options', 'nosniff');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
