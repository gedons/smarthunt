import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ScrapeProcessor } from './processors/scrape.processor';
import { PrismaService } from '../../config/prisma.service';

@Global()
@Module({
  providers: [QueueService, ScrapeProcessor, PrismaService],
  exports: [QueueService],
})
export class QueueModule {}
