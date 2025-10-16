import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  password: process.env.REDIS_PASSWORD,
});

@Injectable()
export class QueueService {
  private queue: Queue;
  constructor() {
    this.queue = new Queue('jobs-queue', { connection });
  }

  async addJob(name: string, payload: any, opts = {}) {
    return this.queue.add(name, payload, { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...opts });
  }
}
