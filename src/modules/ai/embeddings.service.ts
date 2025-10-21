// src/modules/ai/embeddings.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  // tunables
  private batchSize = Number(process.env.EMBED_BATCH_SIZE ?? 200); // default for embedNewJobs
  private readonly maxBatchRequestSize = Number(process.env.GEMINI_MAX_BATCH_SIZE ?? 100); 
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(private prisma: PrismaService, private gemini: GeminiService) {
    this.maxRetries = Number(process.env.EMBED_BATCH_RETRIES ?? 3);
    this.retryDelayMs = Number(process.env.EMBED_RETRY_DELAY_MS ?? 500);
  }

  // embed a single job by jobId (string)
  async embedJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found: ' + jobId);

    const text = `${job.title}\n${job.company ?? ''}\n${job.location ?? ''}\n${job.description ?? ''}`.trim();
    const embedding = await this.gemini.embed(text);
    await this.prisma.jobEmbedding.upsert({
      where: { jobId },
      create: { jobId, embedding },
      update: { embedding },
    });
    this.logger.log(`Embedded job ${jobId}`);
    return embedding;
  }

  // embed a user by auth0Id (string)
  async embedUser(auth0Id: string) {
    const user = await this.prisma.user.findUnique({ where: { auth0Id } });
    if (!user) throw new Error('User not found: ' + auth0Id);
    const text = `${user.name ?? ''}\n${(user.skills || []).join(' ')}\n${user.resumeText ?? ''}`.trim();
    const embedding = await this.gemini.embed(text);
    await this.prisma.user.update({ where: { auth0Id }, data: { vector: embedding } });
    this.logger.log(`Embedded user ${auth0Id}`);
    return embedding;
  }

  // Helper: chunk array into smaller arrays
  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Find jobs without embeddings and embed them in batches.
   * Uses embedJobsByIds internally so behavior is consistent with upsert logic and retries.
   */
  async embedNewJobs(limit = this.batchSize) {
    // Find jobs that do not yet have an embedding
    const jobsWithoutEmb = await this.prisma.job.findMany({
      where: { embedding: null },
      select: { id: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const jobIds = jobsWithoutEmb.map((j) => j.id);
    if (jobIds.length === 0) {
      this.logger.log('No new jobs to embed.');
      return { embedded: 0, failures: [] as string[] };
    }

    this.logger.log(`embedNewJobs found ${jobIds.length} jobs to embed`);
    return this.embedJobsByIds(jobIds, this.maxBatchRequestSize);
  }

  /**
   * Batch-embed a list of job IDs and upsert job embeddings.
   * - jobIds: array of Job.id (strings)
   * - batchSize: optional override for per-call chunk size (defaults to maxBatchRequestSize)
   * - returns: { embedded: number, failures: string[] }
   */
  async embedJobsByIds(jobIds: string[], batchSize?: number) {
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return { embedded: 0, failures: [] as string[] };
    }

    const BATCH = Number(batchSize ?? this.maxBatchRequestSize);
    const failures: string[] = [];
    let embeddedCount = 0;

    this.logger.log(`embedJobsByIds starting: ${jobIds.length} jobIds, chunkSize=${BATCH}, maxRetries=${this.maxRetries}`);

    // split into chunks (each chunk will be a single call to gemini.embedBatch)
    const idChunks = this.chunk(jobIds, BATCH);

    for (let ci = 0; ci < idChunks.length; ci++) {
      const sliceIds = idChunks[ci];
      this.logger.log(`Processing chunk ${ci + 1}/${idChunks.length} (${sliceIds.length} jobs)`);

      // fetch job rows for the current slice
      const jobs = await this.prisma.job.findMany({
        where: { id: { in: sliceIds } },
      });

      // map and re-order jobs according to sliceIds
      const jobMap = new Map(jobs.map((j) => [j.id, j]));
      const orderedJobs = sliceIds.map((id) => jobMap.get(id)).filter(Boolean) as any[];

      if (!orderedJobs.length) {
        this.logger.warn(`No jobs found for ids in this chunk: ${sliceIds.join(',')}`);
        failures.push(...sliceIds);
        continue;
      }

      const texts = orderedJobs.map((j) =>
        `${j.title ?? ''}\n${j.company ?? ''}\n${j.location ?? ''}\n${(j.description ?? '').slice(0, 32000)}`.trim(),
      );

      // Try embedding with retries
      let embeddings: number[][] | null = null;
      let attempt = 0;
      while (attempt < this.maxRetries && embeddings === null) {
        attempt++;
        try {
          embeddings = await this.gemini.embedBatch(texts);
          if (!embeddings || embeddings.length !== texts.length) {
            this.logger.warn(`embedBatch returned unexpected shape on attempt ${attempt}`);
            embeddings = null;
            throw new Error('Invalid embeddings shape');
          }
        } catch (err) {
          this.logger.warn(`embedBatch attempt ${attempt} failed: ${(err as Error).message}`);
          if (attempt < this.maxRetries) {
            const waitMs = this.retryDelayMs ?? 500;
            this.logger.log(`Waiting ${waitMs * attempt}ms before retrying embed batch`);
            await new Promise((r) => setTimeout(r, waitMs * attempt));
          } else {
            this.logger.error(`embedBatch failed after ${attempt} attempts: ${(err as Error).message}`);
          }
        }
      }

      if (!embeddings) {
        this.logger.error(`Batch embedding failed for ${sliceIds.length} jobs; marking as failures`);
        failures.push(...sliceIds);
        continue;
      }

      // Upsert each embedding for orderedJobs
      for (let i = 0; i < orderedJobs.length; i++) {
        const job = orderedJobs[i];
        const emb = embeddings[i] ?? [];
        if (!Array.isArray(emb) || emb.length === 0) {
          this.logger.warn(`Empty embedding for job ${job.id}; skipping upsert`);
          failures.push(job.id);
          continue;
        }

        try {
          await this.prisma.jobEmbedding.upsert({
            where: { jobId: job.id },
            create: { jobId: job.id, embedding: emb },
            update: { embedding: emb },
          });
          embeddedCount++;
          this.logger.log(`Upserted embedding for job ${job.id}`);
        } catch (upsertErr) {
          this.logger.error(`Failed upserting embedding for job ${job.id}: ${(upsertErr as Error).message}`);
          failures.push(job.id);
        }
      } // end per-job upsert
    } // end chunks

    this.logger.log(`embedJobsByIds finished: embedded=${embeddedCount}, failures=${failures.length}`);
    return { embedded: embeddedCount, failures };
  }
}
