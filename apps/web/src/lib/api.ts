/**
 * Klien REST API.
 * Token JWT disimpan pada cookie httpOnly yang di-set backend,
 * sehingga setiap request wajib menyertakan credential.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api')
  .trim()
  .replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

function extractMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Terjadi kesalahan pada server.';
  const message = (payload as { message?: unknown }).message;

  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return 'Terjadi kesalahan pada server.';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(
      'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.',
      0,
    );
  }

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('absensi:unauthorized'));
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(extractMessage(payload), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.blob()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),

  /** Mengunduh berkas (Excel/PDF) lalu memicu penyimpanan di browser. */
  async download(path: string, fallbackName: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        credentials: 'include',
        cache: 'no-store',
      });
    } catch {
      throw new ApiError('Tidak dapat mengunduh berkas. Periksa koneksi Anda.', 0);
    }

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      throw new ApiError(extractMessage(payload), response.status);
    }

    const disposition = response.headers.get('content-disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match?.[1] ?? fallbackName;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
