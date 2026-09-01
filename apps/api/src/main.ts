import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // bodyParser disabled so we can re-register JSON parsing with a 12mb limit:
  // invoice-photo scans arrive as base64 JSON and the express default (100kb)
  // is far too small for phone camera images.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.setGlobalPrefix('api');
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { extended: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Order matters: NestJS applies filters last-registered first.
  // AllExceptionsFilter is the outermost safety net; PrismaExceptionFilter
  // runs before it to handle known Prisma errors with specific HTTP codes.
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());

  const corsOrigin = process.env.CORS_ORIGIN;
  const isDev = process.env.NODE_ENV !== 'production';

  if (!corsOrigin && !isDev) {
    throw new Error(
      'CORS_ORIGIN environment variable must be set in production. ' +
      'Example: CORS_ORIGIN=https://app.daftar.sa',
    );
  }

  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Daftar API listening on http://localhost:${port}/api`);
}

bootstrap();
