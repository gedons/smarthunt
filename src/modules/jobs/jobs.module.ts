import { Module } from '@nestjs/common';
import { JobsService } from './services/jobs.service';
import { JobsController } from './controllers/jobs.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
