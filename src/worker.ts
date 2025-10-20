// src/worker.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { EmbeddingsService } from './modules/ai/embeddings.service';

interface WorkerConfig {
  intervalMs: number;
  maxConcurrent: number;
  timeoutMs: number;
  gracefulShutdownTimeoutMs: number;
}

class EmbedWorker {
  private logger = new Logger('EmbedWorker');
  private isRunning = false;
  private isShuttingDown = false;
  private activeJobs = 0;
  private intervalHandle?: ReturnType<typeof setInterval>;
  private lastRunTime = 0;
  private failureCount = 0;

  constructor(
    private embedSvc: EmbeddingsService,
    private config: WorkerConfig,
  ) {}

  async start(): Promise<void> {
    this.logger.log('Starting embeddings worker...');
    this.setupGracefulShutdown();
    this.isRunning = true;

    // Run initial batch
    await this.runEmbedBatch();

    // Schedule periodic runs
    this.intervalHandle = setInterval(
      () => this.runEmbedBatch(),
      this.config.intervalMs,
    );

    this.logger.log(
      `Worker scheduled with interval: ${this.config.intervalMs}ms`,
    );
  }

  private async runEmbedBatch(): Promise<void> {
    if (this.isShuttingDown || this.activeJobs >= this.config.maxConcurrent) {
      this.logger.debug(
        `Skipping run: shutting_down=${this.isShuttingDown}, active_jobs=${this.activeJobs}`,
      );
      return;
    }

    this.activeJobs++;
    const startTime = Date.now();
    const runId = Math.random().toString(36).substring(7);

    try {
      this.logger.debug(`[${runId}] Starting embeddings batch`);

      const result = await Promise.race([
        this.embedSvc.embedNewJobs(),
        this.createTimeout(),
      ]);

      const duration = Date.now() - startTime;
      this.lastRunTime = duration;
      this.failureCount = 0; // Reset on success

      this.logger.log(
        `[${runId}] Batch complete | duration: ${duration}ms | processed: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      this.failureCount++;
      const duration = Date.now() - startTime;
      const isTimeout = error.message?.includes('timeout');

      this.logger.error(
        `[${runId}] Batch failed | duration: ${duration}ms | failures: ${this.failureCount} | timeout: ${isTimeout}`,
        error instanceof Error ? error.message : String(error),
      );

      // Exponential backoff for circuit breaker
      if (this.failureCount >= 5) {
        this.logger.warn(
          'Max failures reached. Worker will attempt recovery on next interval.',
        );
        this.failureCount = 0;
      }
    } finally {
      this.activeJobs--;
    }
  }

  private createTimeout(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Embeddings batch timeout')),
        this.config.timeoutMs,
      ),
    );
  }

  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, () => {
        this.logger.log(`Received ${signal}, initiating graceful shutdown...`);
        this.gracefulShutdown();
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', reason);
      this.gracefulShutdown();
    });
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    this.logger.log('Waiting for active jobs to complete...');

    const shutdownDeadline = Date.now() + this.config.gracefulShutdownTimeoutMs;
    while (this.activeJobs > 0) {
      if (Date.now() > shutdownDeadline) {
        this.logger.warn(
          `Shutdown timeout exceeded. ${this.activeJobs} jobs still running.`,
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log('Graceful shutdown complete');
    process.exit(0);
  }

  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    lastRunTimeMs: number;
    failureCount: number;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs,
      lastRunTimeMs: this.lastRunTime,
      failureCount: this.failureCount,
    };
  }
}

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    const embedSvc = app.get(EmbeddingsService);

    const config: WorkerConfig = {
      intervalMs: Number(process.env.EMBED_INTERVAL_MS || 1000 * 60 * 10), // 10 min default
      maxConcurrent: Number(process.env.EMBED_MAX_CONCURRENT || 1),
      timeoutMs: Number(process.env.EMBED_TIMEOUT_MS || 1000 * 60 * 5), // 5 min default
      gracefulShutdownTimeoutMs: Number(
        process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || 1000 * 60,
      ), // 1 min
    };

    logger.log(`Worker config: ${JSON.stringify(config)}`);

    const worker = new EmbedWorker(embedSvc, config);

    // Optional: expose status endpoint or metrics (if you add an HTTP server)
    // This can be useful for health checks in production
    if (process.env.WORKER_METRICS_ENABLED === 'true') {
      setInterval(() => {
        const status = worker.getStatus();
        logger.debug(`Worker status: ${JSON.stringify(status)}`);
      }, 1000 * 60 * 5); // Every 5 minutes
    }

    await worker.start();
  } catch (err) {
    logger.error('Worker bootstrap failed', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

bootstrap();