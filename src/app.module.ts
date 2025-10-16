import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import envConfig from './config/env.config';

import { PrismaService } from './config/prisma.service';
import { JobsModule } from './modules/jobs/jobs.module';
import { QueueModule } from './modules/queue/queue.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
    }),
    ScheduleModule.forRoot(),
    JobsModule,
    QueueModule,
    AuthModule,
    UsersModule,
    DatabaseModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
