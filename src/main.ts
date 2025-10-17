// src/main.ts
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
//import { createTerminus } from '@godaddy/terminus';
//import { Logger as PinoLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Body size limits
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());

  // Security headers
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'res.cloudinary.com'],
        connectSrc: [
          "'self'",
          process.env.AUTH0_DOMAIN
            ? `https://${process.env.AUTH0_DOMAIN}`
            : "'self'",
        ],
      },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  });

  // Rate limiter
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: Number(process.env.RATE_LIMIT_MAX || 60),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // use nestjs-pino if installed for structured logging
  // app.useLogger(app.get(PinoLogger));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
