import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import envConfig from './config/env.config';

import { PrismaService } from './config/prisma.service';
import { JobsModule } from './modules/jobs/jobs.module';
import { QueueModule } from './modules/queue/queue.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './modules/database/database.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    ScheduleModule.forRoot(),
    JobsModule,
    QueueModule,
    AuthModule,
    UsersModule,
    DatabaseModule,
    AiModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
