import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import envConfig from './config/env.config';

import { PrismaService } from './config/prisma.service';
import { JobsModule } from './modules/jobs/jobs.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
    }),
    ScheduleModule.forRoot(),
    JobsModule,
    QueueModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
