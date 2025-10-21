// src/worker.ts (extend)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { EmbeddingsService } from './modules/ai/embeddings.service';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });
  logger.log('Worker application context created — queue processors should be running.');

  // optional: run a single embed batch and exit
  const embedSvc = app.get(EmbeddingsService);
  try {
    const result = await embedSvc.embedNewJobs(); // default batch size
    logger.log(`Embedding batch finished: ${JSON.stringify(result)}`);
  } catch (err) {
    logger.error('Embedding batch failed', err);
  } finally {
    // If you want the worker to keep running for queue processors, don't close app.
    // If you only intended this process to run the embed job, uncomment the next lines:
    // await app.close();
    // process.exit(0);
  }
}
bootstrap().catch((err) => {
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
