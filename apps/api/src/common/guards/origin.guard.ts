import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Pertahanan tambahan terhadap CSRF.
 *
 * Di production frontend dan backend berada pada domain berbeda sehingga cookie
 * memakai SameSite=None (cookie ikut terkirim pada request lintas situs). CORS
 * saja tidak cukup untuk menahan request "simple", jadi setiap request yang
 * mengubah data wajib berasal dari origin yang terdaftar di CORS_ORIGIN.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = request.headers.origin;
    // Tanpa header Origin berarti bukan request browser (curl, cron, server-ke-server).
    // Request seperti ini tetap wajib membawa JWT yang valid.
    if (!origin) {
      return true;
    }

    const allowedOrigins = (this.config.get<string>('corsOrigin') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      return true;
    }

    throw new ForbiddenException('Origin permintaan tidak diizinkan.');
  }
}
