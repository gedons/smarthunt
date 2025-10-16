// src/modules/queue/processors/scrape.processor.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../../../config/prisma.service';
import { runScraperForSource } from '../../scrapers';
import { JobSource } from '@prisma/client';
import { runWeWorkRemotely } from '../../scrapers/weworkremotely.scraper';
import { runWellfound } from '../../scrapers/wellfound.scraper';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  password: process.env.REDIS_PASSWORD || undefined,
});

@Injectable()
export class ScrapeProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log(
      `ScrapeProcessor initializing (connecting to ${REDIS_URL})`,
    );

    const worker = new Worker(
      'jobs-queue',
      async (job) => {
        this.logger.log(
          `Worker handler invoked — job id=${job.id} name=${job.name}`,
        );
        try {
          if (job.name === 'scrape') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const { source } = job.data;
            this.logger.log(`Worker: scraping source ${source}`);

            // ✅ Call correct scraper and pass Prisma
            let result;
            if (source === 'WEWORKREMOTELY') {
              result = await runWeWorkRemotely(this.prisma);
            } else if (source === 'WELLFOUND') {
              result = await runWellfound(this.prisma);
            } else {
              result = await runScraperForSource(source, this.prisma);
            }

            this.logger.log(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Worker: finished scraping ${source} — ${result.count} jobs saved.`,
            );

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return result;
          } else {
            this.logger.warn(`Worker: unknown job name "${job.name}"`);
          }
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const msg = (err && (err as Error).message) ?? String(err);
          this.logger.error(
            `Worker error processing job ${job.id}: ${msg}`,
            err,
          );
          throw err;
        }
      },
      { connection },
    );

    // --- Event listeners ---
    worker.on('active', (job) => {
      this.logger.log(`Job ${job.id} is active`);
    });
    worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
      const jobId = job?.id ?? 'unknown';
      const msg = (err && err.message) ?? String(err);
      this.logger.error(`Job ${jobId} failed: ${msg}`);
    });
    worker.on('error', (err) => {
      const msg = (err && err.message) ?? String(err);
      this.logger.error(`Worker-level error: ${msg}`, err);
    });

    this.logger.log(
      'ScrapeProcessor worker started and listening on queue "jobs-queue".',
    );
  }
}
