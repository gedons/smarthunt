// src/modules/queue/processors/scrape.processor.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../../../config/prisma.service';
import { runScraperForSource } from '../../scrapers';
import { QueueService } from '../../queue/queue.service';
import { EmbeddingsService } from '../../ai/embeddings.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  password: process.env.REDIS_PASSWORD || undefined,
});

@Injectable()
export class ScrapeProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  onModuleInit() {
    this.logger.log(`ScrapeProcessor initializing (connecting to ${REDIS_URL})`);

    const worker = new Worker(
      'jobs-queue',
      async (job) => {
        this.logger.log(`Worker handler invoked — job id=${job.id} name=${job.name}`);

        try {
          // --- SCRAPE job ---
          if (job.name === 'scrape') {
            const { source } = job.data as { source: string };
            this.logger.log(`Worker: scraping source ${source}`);

            const start = Date.now();
            // scrapers should return { count, insertedIds } or { count, saved } (urls or ids)
            const result = await runScraperForSource(source, this.prisma);
            this.logger.log(`Worker: finished scraping ${source} -> ${JSON.stringify(result)}`);

            // Normalize returned identifiers
            let rawSaved: string[] = [];
            if (Array.isArray(result?.insertedIds)) rawSaved = result.insertedIds;
            else if (Array.isArray(result?.insertedIds)) rawSaved = result.insertedIds;
            else rawSaved = [];

            // if rawSaved are URLs, resolve to ids; otherwise assume they are ids
            let idList: string[] = [];
            if (rawSaved.length === 0) {
              this.logger.log('No new items to embed from scrape result.');
            } else {
              const looksLikeUrl = rawSaved[0].startsWith('http');
              if (looksLikeUrl) {
                // resolve urls -> ids
                const rows = await this.prisma.job.findMany({
                  where: { url: { in: rawSaved } },
                  select: { id: true },
                });
                idList = rows.map((r) => r.id);
              } else {
                idList = rawSaved;
              }

              if (idList.length > 0) {
                this.logger.log(`Enqueuing embed job for ${idList.length} jobs`);
                await this.queueService.addJob('embed', { jobIds: idList });
              } else {
                this.logger.log('No job IDs resolved for embedding.');
              }
            }

            const duration = Date.now() - start;
            return { scraped: result?.count ?? 0, enqueuedForEmbedding: idList.length, durationMs: duration };
          }

          // --- EMBED job ---
          if (job.name === 'embed') {
            const { jobIds } = job.data as { jobIds: string[] };
            this.logger.log(`Worker: embedding ${Array.isArray(jobIds) ? jobIds.length : 0} jobs`);
            if (!Array.isArray(jobIds) || jobIds.length === 0) {
              this.logger.warn('Embed job had no jobIds');
              return { embedded: 0 };
            }

            const res = await this.embeddingsService.embedJobsByIds(jobIds);
            this.logger.log(`Worker: embed job finished -> ${JSON.stringify(res)}`);
            return res;
          }

          this.logger.warn(`Worker: unknown job name "${job.name}"`);
          return;
        } catch (err) {
          const msg = (err && (err as Error).message) ?? String(err);
          this.logger.error(`Worker error processing job ${job.id}: ${msg}`, err);
          throw err;
        }
      },
      { connection },
    );

    // Event hooks (same as before)
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

    this.logger.log('ScrapeProcessor worker started and listening on queue "jobs-queue".');
  }
}
