/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { QueueService } from '../../queue/queue.service';
const prisma = new PrismaClient();

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(private readonly queueService: QueueService) {}

  async listRecent(limit = 50) {
    return prisma.job.findMany({
      orderBy: { scrapedAt: 'desc' },
      take: limit,
    });
  }

  async upsertJob(jobData: {
    title: string;
    company?: string;
    location?: string;
    url: string;
    description?: string;
    tags?: string[];
    salary?: string;
    source: string;
  }) {
    try {
      return prisma.job.upsert({
        where: { url: jobData.url },
        update: {
          title: jobData.title,
          company: jobData.company,
          location: jobData.location,
          description: jobData.description,
          tags: jobData.tags || [],
          salary: jobData.salary,
          source: jobData.source as any,
          scrapedAt: new Date(),
        },
        create: {
          ...jobData,
          source: jobData.source as any,
        },
      });
    } catch (err) {
      this.logger.error('Error upserting job', err);
      throw err;
    }
  }

  async queueScrape(source: string) {
    const job = await this.queueService.addJob('scrape', { source });
    // When using bullmq Queue.add(), it returns a Job instance
    return { ok: true, jobId: job.id };
  }

}
