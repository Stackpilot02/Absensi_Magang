import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Mencatat setiap operasi tulis ke tabel audit_log.
 * Kegagalan pencatatan audit tidak boleh menggagalkan request utama,
 * tetapi tetap dilaporkan ke log server.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    if (!WRITE_METHODS.has(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((payload) => {
        const entityId =
          payload && typeof payload === 'object' && 'id' in payload
            ? String((payload as { id: unknown }).id)
            : undefined;

        void this.prisma.auditLog
          .create({
            data: {
              userId: request.user?.id ?? null,
              action: `${request.method} ${request.route?.path ?? request.path}`,
              entity: request.path.split('/').filter(Boolean)[1] ?? null,
              entityId,
              method: request.method,
              path: request.originalUrl ?? request.path,
              ip: request.ip,
              userAgent: request.headers['user-agent']?.toString().slice(0, 255),
              metadata: { body: this.sanitize(request.body) } as Prisma.InputJsonObject,
            },
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'kesalahan tidak diketahui';
            this.logger.warn(`Gagal menulis audit log: ${message}`);
          });
      }),
    );
  }

  /** Menghapus field sensitif sebelum disimpan ke audit log. */
  private sanitize(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of ['password', 'passwordBaru', 'passwordLama', 'token', 'currentPassword']) {
      if (key in clone) clone[key] = '***';
    }
    return clone;
  }
}
