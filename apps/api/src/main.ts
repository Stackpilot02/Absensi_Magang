import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { resolveProxiedClientIp } from './common/http/proxy-client-ip';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const proxySharedSecret = config.get<string>('proxySharedSecret') ?? '';

  // Cloudflare Tunnel berjalan di localhost. Percayai hanya loopback agar
  // X-Forwarded-For tidak bisa dipalsukan dari koneksi eksternal.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 'loopback');

  // Cloudflare Pages Function mengirim IP asli pengguna pada X-Client-IP.
  // Header hanya dipercaya bila membawa secret yang sama dengan API.
  app.use((request: Request, _response: Response, next: NextFunction) => {
    const clientIp = resolveProxiedClientIp(request.headers, proxySharedSecret);
    if (clientIp) {
      request.headers['x-forwarded-for'] = clientIp;
    }
    delete request.headers['x-client-ip'];
    delete request.headers['x-proxy-secret'];
    next();
  });

  if (config.get<string>('nodeEnv') === 'production' && !proxySharedSecret) {
    logger.warn(
      'PROXY_SHARED_SECRET kosong. IP klien dan rate limit akan memakai IP proxy Cloudflare.',
    );
  }

  app.use(cookieParser());
  expressApp.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('corsOrigin')?.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();

  const port = config.get<number>('port') ?? 3001;
  const host = config.get<string>('host') ?? '0.0.0.0';
  await app.listen(port, host);
  logger.log(`API berjalan pada ${host}:${port}`);
}

void bootstrap();
