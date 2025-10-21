import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ScrapeProcessor } from './processors/scrape.processor';
import { PrismaService } from '../../config/prisma.service';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';

@Global()
@Module({
  providers: [QueueService, ScrapeProcessor, PrismaService],
  exports: [QueueService],
  imports: [AiModule, DatabaseModule],
})
export class QueueModule {}
