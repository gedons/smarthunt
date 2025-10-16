// src/worker.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  // Create application context (providers & modules initialize)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  logger.log(
    'Worker application context created — queue processors should be running.',
  );
  // Do not call app.listen(); this is a background worker process.
}
bootstrap().catch((err) => {
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
