// src/modules/ai/embeddings.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private batchSize = Number(process.env.EMBED_BATCH_SIZE || 200);
  private readonly maxBatchRequestSize = 100; // Gemini API limit per batch

  constructor(private prisma: PrismaService, private gemini: GeminiService) {}

  // embed a single job by jobId (string)
  async embedJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found: ' + jobId);
    const text = `${job.title}\n${job.company ?? ''}\n${job.location ?? ''}\n${job.description ?? ''}`;
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
    const text = `${user.name ?? ''}\n${(user.skills || []).join(' ')}\n${user.resumeText ?? ''}`;
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

  // batch embed new jobs (uses gemini.embedBatch with chunking)
  async embedNewJobs(limit = this.batchSize) {
    const existing = await this.prisma.jobEmbedding.findMany({
      select: { jobId: true },
    });
    const seen = new Set(existing.map((e) => e.jobId));
    const jobs = await this.prisma.job.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const toEmbed = jobs.filter((j) => !seen.has(j.id));

    if (toEmbed.length === 0) {
      this.logger.log('No new jobs to embed');
      return { embedded: 0 };
    }

    this.logger.log(`Embedding ${toEmbed.length} jobs (limit ${limit})`);

    // Prepare text for all jobs
    const jobTexts = toEmbed.map((j) => ({
      jobId: j.id,
      text: `${j.title}\n${j.company ?? ''}\n${j.location ?? ''}\n${j.description ?? ''}`,
    }));

    // Split into chunks of max 100 (Gemini API limit)
    const chunks = this.chunk(jobTexts, this.maxBatchRequestSize);
    let totalEmbedded = 0;

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      this.logger.debug(
        `Processing chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} items)`,
      );

      try {
        const texts = chunk.map((item) => item.text);
        const embeddings = await this.gemini.embedBatch(texts);

        // Save embeddings to database
        for (let i = 0; i < chunk.length; i++) {
          const jobId = chunk[i].jobId;
          const emb = embeddings[i] ?? [];

          if (!emb || emb.length === 0) {
            this.logger.warn(`Empty embedding for job ${jobId}`);
            continue;
          }

          await this.prisma.jobEmbedding.upsert({
            where: { jobId },
            create: { jobId, embedding: emb },
            update: { embedding: emb },
          });

          totalEmbedded++;
        }

        this.logger.log(
          `Chunk ${chunkIdx + 1}/${chunks.length} complete: ${chunk.length} embeddings saved`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to embed chunk ${chunkIdx + 1}/${chunks.length}`,
          err instanceof Error ? err.message : String(err),
        );
        // Continue with next chunk instead of failing completely
        throw err; // Re-throw to let worker handle retries
      }
    }

    this.logger.log(`Total jobs embedded: ${totalEmbedded}`);
    return { embedded: totalEmbedded };
  }
}