import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(cookieParser());
  app.getHttpAdapter().getInstance().disable('x-powered-by');
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

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
  logger.log(`API berjalan pada port ${port}`);
}

void bootstrap();
