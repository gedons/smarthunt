import { Module } from '@nestjs/common';
import { JobsService } from './services/jobs.service';
import { JobsController } from './controllers/jobs.controller';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [QueueModule, AiModule, DatabaseModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
